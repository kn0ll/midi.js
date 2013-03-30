define [
  './lib/parser',
  './lib/writer',
  './lib/events'
], (Parser, Writer, Events) ->
  exports = exports or window
  
  exports.MIDI = class

    @Writer: Writer
    @Parser: Parser
    @Events: Events

    constructor: (header, tracks) ->
      if typeof header is 'string'
        parser = new Parser(header)
        { header, tracks } = parser.parse()

      @header = header
      @tracks = tracks

    write: ->
      writer = new Writer(@)
      writer.write()