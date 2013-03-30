define ->

  class ReadStream

    constructor: (str) ->
      @str = str
      @position = 0

    read: (length) ->
      result = @str.substr(@position, length)
      @position += length
      result

    readInt32: ->
      str = @str
      position = @position
      result = ((str.charCodeAt(position) << 24) + (str.charCodeAt(position + 1) << 16) + (str.charCodeAt(position + 2) << 8) + str.charCodeAt(position + 3))
      @position += 4
      result

    readInt16: ->
      str = @str
      position = @position
      result = ((str.charCodeAt(position) << 8) + str.charCodeAt(position + 1))
      @position += 2
      result

    readInt8: (signed) ->
      result = @str.charCodeAt(@position)
      result -= 256  if signed and result > 127
      @position += 1
      result

    eof: ->
      @position >= @str.length

  class MIDIReadStream extends ReadStream

    # read a MIDI-style variable-length integer
    # (big-endian value in groups of 7 bits,
    # with top bit set to signify that another byte follows) 
    readVarInt: ->
      result = 0
      loop
        b = @readInt8()
        if b & 0x80
          result += (b & 0x7f)
          result <<= 7
        else
          return result + b

    # MIDI specific stream method,
    # pulls the next MIDI chunk from the stream
    readChunk: ->
      id = @read(4)
      length = @readInt32()
      data = @read(length)
      id: id
      length: length
      data: data