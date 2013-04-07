define [
  './stream',
  './events'
], (MIDIReadStream, Events) ->

  class MIDIEventParser

    constructor: (stream, time, eventTypeByte) ->
      @stream = stream
      @time = time
      @eventTypeByte = eventTypeByte

    @checkLength: (name, length, check) ->
      err = "Expected length for #{name} event is #{check}, got #{length}"
      throw err unless length is check

  class MIDIMetaEventParser extends MIDIEventParser

    @events:

      0x00: (length, stream, time) ->
        MIDIEventParser.checkLength('SequenceNumber', length, 2)
        new Events.SequenceNumber(stream.readInt16(), time)

      0x01: (length, stream, time) ->
        new Events.Text(stream.read(length), time)

      0x02: (length, stream, time) ->
        new Events.CopyrightNotice(stream.read(length), time)

      0x03: (length, stream, time) ->
        new Events.TrackName(stream.read(length), time)

      0x04: (length, stream, time) ->
        new Events.InstrumentName(stream.read(length), time)

      0x05: (length, stream, time) ->
        new Events.Lyrics(stream.read(length), time)

      0x06: (length, stream, time) ->
        new Events.Marker(stream.read(length), time)

      0x07: (length, stream, time) ->
        new Events.CuePoint(stream.read(length), time)

      0x20: (length, stream, time) ->
        MIDIEventParser.checkLength('ChannelPrefix', length, 1)
        new Events.ChannelPrefix(stream.readInt8(), time)

      0x2f: (length, stream, time) ->
        MIDIEventParser.checkLength('EndOfTrack', length, 0)
        new Events.EndOfTrack time

      0x51: (length, stream, time) ->
        MIDIEventParser.checkLength('SetTempo', length, 3)
        new Events.SetTempo(((stream.readInt8() << 16) + (stream.readInt8() << 8) + stream.readInt8()), time)

      0x54: (length, stream, time) ->
        MIDIEventParser.checkLength('SMPTEOffset', length, 5)
        hour_byte = stream.readInt8()
        frame_rate = { 0x00: 24, 0x20: 25, 0x40: 29, 0x60: 30 }[hour_byte & 0x60]
        new Events.SMPTEOffset(frame_rate, hour_byte & 0x1f, stream.readInt8(), stream.readInt8(), stream.readInt8(), stream.readInt8(), time)

      0x58: (length, stream, time) ->
        MIDIEventParser.checkLength('TimeSignature', length, 4)
        new Events.TimeSignature(stream.readInt8(), Math.pow(2, stream.readInt8()), stream.readInt8(), stream.readInt8(), time)

      0x59: (length, stream, time) ->
        MIDIEventParser.checkLength('KeySignature', length, 2)
        new Events.KeySignature(stream.readInt8(true), stream.readInt8(), time)

      0x7f: (length, stream, time) ->
        new Events.SequencerSpecific(stream.read(length), time)

    parse:  ->
      nameByte = @stream.readInt8()
      length = @stream.readVarInt()
      create_event = MIDIMetaEventParser.events[nameByte]
      (if create_event then create_event(length, @stream, @time) else
        type: "unknown"
        time: @time
        data: @stream.read(length)
      )

  class MIDIChannelEventParser extends MIDIEventParser

    @events:

      0x08: (param, stream, time) ->
        new Events.NoteOff(param, stream.readInt8(), time)

      0x09: (param, stream, time) ->
        velocity = stream.readInt8()
        event = (if velocity then "NoteOn" else "NoteOff")
        new Events[event](param, velocity, time)

      0x0a: (param, stream, time) ->
        new Events.NoteAftertouch(param, stream.readInt8(), time)

      0x0b: (param, stream, time) ->
        new Events.Controller(param, stream.readInt8(), time)

      0x0c: (param, stream, time) ->
        new Events.ProgramChange(param, time)

      0x0d: (param, stream, time) ->
        new Events.ChannelAftertouch(param, time)

      0x0e: (param, stream, time) ->
        new Events.PitchBend(param + (stream.readInt8() << 7), time)

    parse: ->
      eventTypeByte = @eventTypeByte

      if (eventTypeByte & 0x80) is 0
        param = eventTypeByte
        eventTypeByte = @_lastEventTypeByte

      else
        param = @stream.readInt8()
        @_lastEventTypeByte = eventTypeByte
      
      # todo: add channel # attr to channel events
      eventType = eventTypeByte >> 4
      channel = eventTypeByte & 0x0f
      create_event = MIDIChannelEventParser.events[eventType]
      (if create_event then create_event(param, @stream, @time) else
        type: "unknown"
        time: @time
        channel: channel
      )

  class MIDISysEventParser extends MIDIEventParser

    @events:

      0xf0: (stream, time) ->
        length = stream.readVarInt()
        new Events.SysEx(stream.read(length), time)

      0xf7: (stream, time) ->
        length = stream.readVarInt()
        new Events.DividedSysEx(stream.read(length), time)

    parse: ->
      create_event = MIDISysEventParser.events[@eventTypeByte]
      (if create_event then create_event(@stream, @time) else
        type: "unknown"
        time: @time
      )

  class MIDITrackParser

    constructor: (track_chunk) ->
      @chunk = track_chunk

    parse: ->
      track_id = @chunk.id
      unexpected = track_id isnt "MTrk"
      throw "Unexpected chunk. Expected MTrk, got #{track_id}." if unexpected

      events = []
      stream = new MIDIReadStream(@chunk.data)
      while not stream.eof()
        time = stream.readVarInt()
        event_type_byte = stream.readInt8()
        Parser = @getEventParserByTypeByte(event_type_byte)
        parser = new Parser(stream, time, event_type_byte)
        events.push parser.parse()
      events

    getEventParserByTypeByte: (event_type_byte) ->
      if (event_type_byte & 0xf0) isnt 0xf0 then MIDIChannelEventParser
      else if event_type_byte is 0xff then MIDIMetaEventParser
      else MIDISysEventParser

  class MIDIHeaderParser

    constructor: (header_chunk) ->
      @chunk = header_chunk

    parse: ->
      invalid = @chunk.id isnt "MThd" or @chunk.length isnt 6
      throw "Bad .mid file - header not found" if invalid
      stream = new MIDIReadStream(@chunk.data)
      header = 
        formatType: stream.readInt16()
        trackCount: stream.readInt16()
        ticksPerBeat: stream.readInt16()
      invalid = header.ticksPerBeat & 0x8000
      throw "Expressing time division in SMPTE frames is not supported yet" if invalid
      header

  class MIDIParser

    constructor: (binaryString) ->
      @binaryString = binaryString

    parse: ->
      midi_stream = new MIDIReadStream(@binaryString)

      header_chunk = midi_stream.readChunk()
      header_parser = new MIDIHeaderParser(header_chunk)
      header = header_parser.parse()

      tracks = []
      while not midi_stream.eof()
        track_chunk = midi_stream.readChunk()
        track_parser = new MIDITrackParser(track_chunk)
        tracks.push track_parser.parse()

      header: header
      tracks: tracks