define ->

  SequenceNumber: (number, time) ->
    @type = 'meta'
    @name = 'sequenceNumber'
    @number = number
    @time = time or 0

  Text: (text, time) ->
    @type = 'meta'
    @name = 'text'
    @text = text
    @time = time or 0

  CopyrightNotice: (text, time) ->
    @type = 'meta'
    @name = 'copyrightNotice'
    @text = text
    @time = time or 0

  TrackName: (text, time) ->
    @type = 'meta'
    @name = 'trackName'
    @text = text
    @time = time or 0

  InstrumentName: (text, time) ->
    @type = 'meta'
    @name = 'instrumentName'
    @text = text
    @time = time or 0

  Lyrics: (text, time) ->
    @name = 'lyrics'
    @text = text
    @time = time or 0

  Marker: (text, time) ->
    @type = 'meta'
    @name = 'marker'
    @text = text
    @time = time or 0

  CuePoint: (text, time) ->
    @type = 'meta'
    @name = 'cuePoint'
    @text = text
    @time = time or 0

  ChannelPrefix: (channel, time) ->
    @type = 'meta'
    @name = 'channelPrefix'
    @channel = channel
    @time = time or 0

  EndOfTrack: (time) ->
    @type = 'meta'
    @name = 'endOfTrack'
    @time = time or 0

  SetTempo: (microseconds, time) ->
    @type = 'meta'
    @name = 'setTempo'
    @microseconds = microseconds
    @time = time or 0

  SMPTEOffset: (frameRate, hour, min, sec, frame, subframe, time) ->
    @type = 'meta'
    @name = 'smpteOffset'
    @frameRate = frameRate
    @hour = hour
    @min = min
    @sec = sec
    @frame = frame
    @subframe = subframe
    @time = time or 0

  TimeSignature: (numerator, denominator, metronome, thirtyseconds, time) ->
    @type = 'meta'
    @name = 'timeSignature'
    @numerator = numerator
    @denominator = denominator
    @metronome = metronome
    @thirtyseconds = thirtyseconds
    @time = time or 0

  KeySignature: (key, scale, time) ->
    @type = 'meta'
    @name = 'keySignature'
    @key = key
    @scale = scale
    @time = time or 0

  SequencerSpecific: (data, time) ->
    @type = 'meta'
    @name = 'sequencerSpecific'
    @data = data
    @time = time or 0

  NoteOn: (number, velocity, time) ->
    @type = 'channel'
    @name = 'noteOn'
    @number  = number
    @velocity = velocity
    @time = time or 0

  NoteOff: (number, velocity, time) ->
    @type = 'channel'
    @name = 'noteOff'
    @number = number
    @velocity = velocity
    @time = time or 0

  NoteAftertouch: (number, amount, time) ->
    @type = 'channel'
    @name = 'noteAftertouch'
    @number = number
    @amount = amount
    @time = time or 0

  Controller: (controller, value, time) ->
    @type = 'channel'
    @name = 'controller'
    @controller = controller
    @value = value
    @time = time or 0

  ProgramChange: (number, time) ->
    @type = 'channel'
    @name = 'programChange'
    @number = number
    @time = time or 0

  ChannelAftertouch: (amount, time) ->
    @type = 'channel'
    @name = 'channelAftertouch'
    @amount = amount
    @time = time or 0

  PitchBend: (value, time) ->
    @type = 'channel'
    @controller = controller
    @value = value
    @time = time or 0