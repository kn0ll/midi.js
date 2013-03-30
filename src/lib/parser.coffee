define [
  './stream',
  './events'
], (Stream, Events) ->

  class EventParser

    @checkLength: (name, length, check) ->
      throw "Expected length for #{name} event is #{check}, got #{length}" unless length is check
      return true if length is check

  class MetaEventParser extends EventParser

    @events: 

      0x00: (length, stream, time) ->
        return unless MetaEventParser.checkLength('SequenceNumber', length, 2)
        new MIDI.Events.SequenceNumber(stream.readInt16(), time)

      0x01: (length, stream, time) ->
        new MIDI.Events.Text(stream.read(length), time)

      0x02: (length, stream, time) ->
        new MIDI.Events.CopyrightNotice(stream.read(length), time)

      0x03: (length, stream, time) ->
        new MIDI.Events.TrackName(stream.read(length), time)

      0x04: (length, stream, time) ->
        new MIDI.Events.InstrumentName(stream.read(length), time)

      0x05: (length, stream, time) ->
        new MIDI.Events.Lyrics(stream.read(length), time)

      0x06: (length, stream, time) ->
        new MIDI.Events.Marker(stream.read(length), time)

      0x07: (length, stream, time) ->
        new MIDI.Events.CuePoint(stream.read(length), time)

      0x20: (length, stream, time) ->
        return unless MetaEventParser.checkLength('ChannelPrefix', length, 1)
        new MIDI.Events.ChannelPrefix(stream.readInt8(), time)

      0x2f: (length, stream, time) ->
        return unless MetaEventParser.checkLength('EndOfTrack', length, 0)
        new MIDI.Events.EndOfTrack time

      0x51: (length, stream, time) ->
        return unless MetaEventParser.checkLength('SetTempo', length, 3)
        new MIDI.Events.SetTempo(((stream.readInt8() << 16) + (stream.readInt8() << 8) + stream.readInt8()), time)

      0x54: (length, stream, time) ->
        return unless MetaEventParser.checkLength('SMPTEOffset', length, 5)
        hour_byte = stream.readInt8()
        frame_rate =
          0x00: 24
          0x20: 25
          0x40: 29
          0x60: 30
        frame_rate = frame_rate[hour_byte & 0x60]
        new SMPTEOffset(frame_rate, hour_byte & 0x1f, stream.readInt8(), stream.readInt8(), stream.readInt8(), stream.readInt8(), time)

      0x58: (length, stream, time) ->
        return unless MetaEventParser.checkLength('TimeSignature', length, 4)
        new MIDI.Events.TimeSignature(stream.readInt8(), Math.pow(2, stream.readInt8()), stream.readInt8(), stream.readInt8(), time)

      0x59: (length, stream, time) ->
        return unless MetaEventParser.checkLength('KeySignature', length, 2)
        new MIDI.Events.KeySignature(stream.readInt8(true), stream.readInt8(), time)

      0x7f: (length, stream, time) ->
        new MIDI.Events.SequencerSpecific(stream.read(length), time)

    read: (stream, time, eventTypeByte) ->
      nameByte = stream.readInt8()
      length = stream.readVarInt()
      create_event = MetaEventParser.events[nameByte]
      (if create_event then create_event(length, stream, time) else
        type: "unknown"
        time: time
        data: stream.read(length)
      )

  class ChannelEventParser extends EventParser

    @events:

      0x08: (param, stream, time) ->
        new MIDI.Events.NoteOff(param, stream.readInt8(), time)

      0x09: (param, stream, time) ->
        velocity = stream.readInt8()
        event_name = (if velocity then "NoteOn" else "NoteOff")
        new MIDI.Events[event_name](param, velocity, time)

      0x0a: (param, stream, time) ->
        new MIDI.Events.NoteAftertouch(param, stream.readInt8(), time)

      0x0b: (param, stream, time) ->
        new MIDI.Events.Controller(param, stream.readInt8(), time)

      0x0c: (param, stream, time) ->
        new MIDI.Events.ProgramChange(param, time)

      0x0d: (param, stream, time) ->
        new MIDI.Events.ChannelAftertouch(param, time)

      0x0e: (param, stream, time) ->
        new MIDI.Events.PitchBend(param + (stream.readInt8() << 7), time)

    read: (stream, time, eventTypeByte) ->

      if (eventTypeByte & 0x80) is 0
        param = eventTypeByte
        eventTypeByte = @_lastEventTypeByte

      else
        param = stream.readInt8()
        @_lastEventTypeByte = eventTypeByte
      
      # todo: add channel # attr to channel events
      eventType = eventTypeByte >> 4
      channel = eventTypeByte & 0x0f
      create_event = ChannelEventParser.events[eventType]
      (if create_event then create_event(param, stream, time) else
        type: "unknown"
        time: time
        channel: channel
      )

  class SysEventParser extends EventParser

    @events:

      0xf0: (stream, time) ->
        length = stream.readVarInt()
        new MIDI.Events.SysEx(stream.read(length), time)

      0xf7: (stream, time) ->
        length = stream.readVarInt()
        new MIDI.Events.DividedSysEx(stream.read(length), time)

    read: (stream, time, eventTypeByte) ->
      create_event = SysEventParser.events[eventTypeByte]
      (if create_event then create_event(stream, time) else
        type: "unknown"
        time: time
      )

  class MIDIHeader

    constructor: (midi_stream) ->
      @midi_stream = midi_stream

    read: ->
      header_chunk = @midi_stream.readChunk()

      if header_chunk.id isnt "MThd" or header_chunk.length isnt 6
        throw "Bad .mid file - header not found"

      header_stream = new Stream(header_chunk.data)

      header =
        formatType: header_stream.readInt16()
        trackCount: header_stream.readInt16()
        ticksPerBeat: header_stream.readInt16()

      if header.ticksPerBeat & 0x8000
        throw "Expressing time division in SMTPE frames is not supported yet"

      header
    
  class MIDITracks

    constructor: (midi_stream, header) ->
      @midi_stream = midi_stream
      @header = header

    read: ->
      tracks = []

      for i in [0..@header.trackCount-1]
        track = tracks[i] = []
        track_chunk = @midi_stream.readChunk()
        track_id = track_chunk.id
        unexpected = track_id isnt "MTrk"
        throw "Unexpected chunk. Expected MTrk, got " + track_id + "."  if unexpected
        track_stream = new Stream(track_chunk.data)
        track.push @readNext(track_stream)  until track_stream.eof()

      tracks

    readNext: (track_stream) ->
      e = new Event(track_stream)
      time = track_stream.readVarInt()
      eventTypeByte = track_stream.readInt8()
      EventParser = @getEventParserByType(eventTypeByte)
      parser = new EventParser()
      parser.read(track_stream, time, eventTypeByte)

    getEventParserByType: (eventTypeByte) ->
      if (eventTypeByte & 0xf0) isnt 0xf0 then ChannelEventParser
      else if eventTypeByte is 0xff then MetaEventParser
      else SysEventParser

  class MIDIParser

    constructor: (binaryString) ->
      midi_stream = new Stream(binaryString)

      header_parser = new MIDIHeader(midi_stream)
      header = header_parser.read()

      track_parser = new MIDITracks(midi_stream, header)
      tracks = track_parser.read()

      @header = header
      @tracks = tracks