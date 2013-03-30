# midi.js

a library for writing MIDI files, reading MIDI files, and representing MIDI files as an intermediary JSON structure. nothing more, nothing less.

## including

simply add a `script` tag to your page linking to the [midi.js](https://github.com/catshirt/midi.js/blob/master/dist/midi.js) built script. this will expose a global `MIDI` object.

## using

### to read files

midi.js accepts a binary string as it's input. the example below shows how to parse a midi file selected from a `file` type input.

```
onFileChange = (fileInput) ->
  files = fileInput.files
  reader = new FileReader()

  reader.onload = (load_e) ->
    midi = new MIDI(load_e.target.result)
    console.log midi

  reader.readAsBinaryString(files[0])
```

### to write files

instead of accepting a binary string, the MIDI constructor can also accept predefined `header` and `track` objects. additionally, any MIDI file can call `write` to return the encoded contents of the midi.

```
header =
  formatType: 0
  trackCount: 1
  ticksPerBeat: 96

track1 = [
  new MIDI.Events.TrackName(''),
  new MIDI.Events.TimeSignature(4, 4, 36, 8),
  new MIDI.Events.NoteOn(65, 100),
  new MIDI.Events.NoteOff(65, 64, 24),
  new MIDI.Events.NoteOn(70, 100, 168),
  new MIDI.Events.NoteOff(70, 64, 24),
  new MIDI.Events.EndOfTrack()
]

midi = new MIDI(header, [track1])
console.log(midi.write())
```

## compiling, developing

two primary Gruntfile tasks are exposed for purposes of developement.

`build` - will compile coffeescript files, and build the requirejs distributed packages
`default` - will run build, and setup a watcher to rebuild on file changes