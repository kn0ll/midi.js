define ->

  class MIDIWriter

    constructor: (midi) ->
      @midi = midi

    write: ->
      JSON.stringify(@midi)