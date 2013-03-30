(function(exports) {
/**
 * almond 0.2.5 Copyright (c) 2011-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);

                name = baseParts.concat(name.split("/"));

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (typeof callback === 'function') {

            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback.apply(defined[name], args);

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        config = cfg;
        if (config.deps) {
            req(config.deps, config.callback);
        }
        return req;
    };

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define("almond", function(){});

define('lib/stream',[],function() {
  var MIDIStream;

  return MIDIStream = (function() {
    function MIDIStream(str) {
      this.str = str;
      this.position = 0;
    }

    MIDIStream.prototype.read = function(length) {
      var result;

      result = this.str.substr(this.position, length);
      this.position += length;
      return result;
    };

    MIDIStream.prototype.readInt32 = function() {
      var position, result, str;

      str = this.str;
      position = this.position;
      result = (str.charCodeAt(position) << 24) + (str.charCodeAt(position + 1) << 16) + (str.charCodeAt(position + 2) << 8) + str.charCodeAt(position + 3);
      this.position += 4;
      return result;
    };

    MIDIStream.prototype.readInt16 = function() {
      var position, result, str;

      str = this.str;
      position = this.position;
      result = (str.charCodeAt(position) << 8) + str.charCodeAt(position + 1);
      this.position += 2;
      return result;
    };

    MIDIStream.prototype.readInt8 = function(signed) {
      var result;

      result = this.str.charCodeAt(this.position);
      if (signed && result > 127) {
        result -= 256;
      }
      this.position += 1;
      return result;
    };

    MIDIStream.prototype.eof = function() {
      return this.position >= this.str.length;
    };

    MIDIStream.prototype.readVarInt = function() {
      var b, result;

      result = 0;
      while (true) {
        b = this.readInt8();
        if (b & 0x80) {
          result += b & 0x7f;
          result <<= 7;
        } else {
          return result + b;
        }
      }
    };

    MIDIStream.prototype.readChunk = function() {
      var data, id, length;

      id = this.read(4);
      length = this.readInt32();
      data = this.read(length);
      return {
        id: id,
        length: length,
        data: data
      };
    };

    return MIDIStream;

  })();
});

define('lib/events',[],function() {
  return {
    SequenceNumber: function(number, time) {
      this.type = 'meta';
      this.name = 'sequenceNumber';
      this.number = number;
      return this.time = time || 0;
    },
    Text: function(text, time) {
      this.type = 'meta';
      this.name = 'text';
      this.text = text;
      return this.time = time || 0;
    },
    CopyrightNotice: function(text, time) {
      this.type = 'meta';
      this.name = 'copyrightNotice';
      this.text = text;
      return this.time = time || 0;
    },
    TrackName: function(text, time) {
      this.type = 'meta';
      this.name = 'trackName';
      this.text = text;
      return this.time = time || 0;
    },
    InstrumentName: function(text, time) {
      this.type = 'meta';
      this.name = 'instrumentName';
      this.text = text;
      return this.time = time || 0;
    },
    Lyrics: function(text, time) {
      this.name = 'lyrics';
      this.text = text;
      return this.time = time || 0;
    },
    Marker: function(text, time) {
      this.type = 'meta';
      this.name = 'marker';
      this.text = text;
      return this.time = time || 0;
    },
    CuePoint: function(text, time) {
      this.type = 'meta';
      this.name = 'cuePoint';
      this.text = text;
      return this.time = time || 0;
    },
    ChannelPrefix: function(channel, time) {
      this.type = 'meta';
      this.name = 'channelPrefix';
      this.channel = channel;
      return this.time = time || 0;
    },
    EndOfTrack: function(time) {
      this.type = 'meta';
      this.name = 'endOfTrack';
      return this.time = time || 0;
    },
    SetTempo: function(microseconds, time) {
      this.type = 'meta';
      this.name = 'setTempo';
      this.microseconds = microseconds;
      return this.time = time || 0;
    },
    SMPTEOffset: function(frameRate, hour, min, sec, frame, subframe, time) {
      this.type = 'meta';
      this.name = 'smpteOffset';
      this.frameRate = frameRate;
      this.hour = hour;
      this.min = min;
      this.sec = sec;
      this.frame = frame;
      this.subframe = subframe;
      return this.time = time || 0;
    },
    TimeSignature: function(numerator, denominator, metronome, thirtyseconds, time) {
      this.type = 'meta';
      this.name = 'timeSignature';
      this.numerator = numerator;
      this.denominator = denominator;
      this.metronome = metronome;
      this.thirtyseconds = thirtyseconds;
      return this.time = time || 0;
    },
    KeySignature: function(key, scale, time) {
      this.type = 'meta';
      this.name = 'keySignature';
      this.key = key;
      this.scale = scale;
      return this.time = time || 0;
    },
    SequencerSpecific: function(data, time) {
      this.type = 'meta';
      this.name = 'sequencerSpecific';
      this.data = data;
      return this.time = time || 0;
    },
    NoteOn: function(number, velocity, time) {
      this.type = 'channel';
      this.name = 'noteOn';
      this.number = number;
      this.velocity = velocity;
      return this.time = time || 0;
    },
    NoteOff: function(number, velocity, time) {
      this.type = 'channel';
      this.name = 'noteOff';
      this.number = number;
      this.velocity = velocity;
      return this.time = time || 0;
    },
    NoteAftertouch: function(number, amount, time) {
      this.type = 'channel';
      this.name = 'noteAftertouch';
      this.number = number;
      this.amount = amount;
      return this.time = time || 0;
    },
    Controller: function(controller, value, time) {
      this.type = 'channel';
      this.name = 'controller';
      this.controller = controller;
      this.value = value;
      return this.time = time || 0;
    },
    ProgramChange: function(number, time) {
      this.type = 'channel';
      this.name = 'programChange';
      this.number = number;
      return this.time = time || 0;
    },
    ChannelAftertouch: function(amount, time) {
      this.type = 'channel';
      this.name = 'channelAftertouch';
      this.amount = amount;
      return this.time = time || 0;
    },
    PitchBend: function(value, time) {
      this.type = 'channel';
      this.controller = controller;
      this.value = value;
      return this.time = time || 0;
    }
  };
});

var __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

define('lib/parser',['./stream', './events'], function(Stream, Events) {
  var ChannelEventParser, EventParser, MIDIHeader, MIDIParser, MIDITracks, MetaEventParser, SysEventParser, _ref, _ref1, _ref2;

  EventParser = (function() {
    function EventParser() {}

    EventParser.checkLength = function(name, length, check) {
      if (length !== check) {
        throw "Expected length for " + name + " event is " + check + ", got " + length;
      }
      if (length === check) {
        return true;
      }
    };

    return EventParser;

  })();
  MetaEventParser = (function(_super) {
    __extends(MetaEventParser, _super);

    function MetaEventParser() {
      _ref = MetaEventParser.__super__.constructor.apply(this, arguments);
      return _ref;
    }

    MetaEventParser.events = {
      0x00: function(length, stream, time) {
        if (!MetaEventParser.checkLength('SequenceNumber', length, 2)) {
          return;
        }
        return new MIDI.Events.SequenceNumber(stream.readInt16(), time);
      },
      0x01: function(length, stream, time) {
        return new MIDI.Events.Text(stream.read(length), time);
      },
      0x02: function(length, stream, time) {
        return new MIDI.Events.CopyrightNotice(stream.read(length), time);
      },
      0x03: function(length, stream, time) {
        return new MIDI.Events.TrackName(stream.read(length), time);
      },
      0x04: function(length, stream, time) {
        return new MIDI.Events.InstrumentName(stream.read(length), time);
      },
      0x05: function(length, stream, time) {
        return new MIDI.Events.Lyrics(stream.read(length), time);
      },
      0x06: function(length, stream, time) {
        return new MIDI.Events.Marker(stream.read(length), time);
      },
      0x07: function(length, stream, time) {
        return new MIDI.Events.CuePoint(stream.read(length), time);
      },
      0x20: function(length, stream, time) {
        if (!MetaEventParser.checkLength('ChannelPrefix', length, 1)) {
          return;
        }
        return new MIDI.Events.ChannelPrefix(stream.readInt8(), time);
      },
      0x2f: function(length, stream, time) {
        if (!MetaEventParser.checkLength('EndOfTrack', length, 0)) {
          return;
        }
        return new MIDI.Events.EndOfTrack(time);
      },
      0x51: function(length, stream, time) {
        if (!MetaEventParser.checkLength('SetTempo', length, 3)) {
          return;
        }
        return new MIDI.Events.SetTempo((stream.readInt8() << 16) + (stream.readInt8() << 8) + stream.readInt8(), time);
      },
      0x54: function(length, stream, time) {
        var frame_rate, hour_byte;

        if (!MetaEventParser.checkLength('SMPTEOffset', length, 5)) {
          return;
        }
        hour_byte = stream.readInt8();
        frame_rate = {
          0x00: 24,
          0x20: 25,
          0x40: 29,
          0x60: 30
        };
        frame_rate = frame_rate[hour_byte & 0x60];
        return new SMPTEOffset(frame_rate, hour_byte & 0x1f, stream.readInt8(), stream.readInt8(), stream.readInt8(), stream.readInt8(), time);
      },
      0x58: function(length, stream, time) {
        if (!MetaEventParser.checkLength('TimeSignature', length, 4)) {
          return;
        }
        return new MIDI.Events.TimeSignature(stream.readInt8(), Math.pow(2, stream.readInt8()), stream.readInt8(), stream.readInt8(), time);
      },
      0x59: function(length, stream, time) {
        if (!MetaEventParser.checkLength('KeySignature', length, 2)) {
          return;
        }
        return new MIDI.Events.KeySignature(stream.readInt8(true), stream.readInt8(), time);
      },
      0x7f: function(length, stream, time) {
        return new MIDI.Events.SequencerSpecific(stream.read(length), time);
      }
    };

    MetaEventParser.prototype.read = function(stream, time, eventTypeByte) {
      var create_event, length, nameByte;

      nameByte = stream.readInt8();
      length = stream.readVarInt();
      create_event = MetaEventParser.events[nameByte];
      if (create_event) {
        return create_event(length, stream, time);
      } else {
        return {
          type: "unknown",
          time: time,
          data: stream.read(length)
        };
      }
    };

    return MetaEventParser;

  })(EventParser);
  ChannelEventParser = (function(_super) {
    __extends(ChannelEventParser, _super);

    function ChannelEventParser() {
      _ref1 = ChannelEventParser.__super__.constructor.apply(this, arguments);
      return _ref1;
    }

    ChannelEventParser.events = {
      0x08: function(param, stream, time) {
        return new MIDI.Events.NoteOff(param, stream.readInt8(), time);
      },
      0x09: function(param, stream, time) {
        var event_name, velocity;

        velocity = stream.readInt8();
        event_name = (velocity ? "NoteOn" : "NoteOff");
        return new MIDI.Events[event_name](param, velocity, time);
      },
      0x0a: function(param, stream, time) {
        return new MIDI.Events.NoteAftertouch(param, stream.readInt8(), time);
      },
      0x0b: function(param, stream, time) {
        return new MIDI.Events.Controller(param, stream.readInt8(), time);
      },
      0x0c: function(param, stream, time) {
        return new MIDI.Events.ProgramChange(param, time);
      },
      0x0d: function(param, stream, time) {
        return new MIDI.Events.ChannelAftertouch(param, time);
      },
      0x0e: function(param, stream, time) {
        return new MIDI.Events.PitchBend(param + (stream.readInt8() << 7), time);
      }
    };

    ChannelEventParser.prototype.read = function(stream, time, eventTypeByte) {
      var channel, create_event, eventType, param;

      if ((eventTypeByte & 0x80) === 0) {
        param = eventTypeByte;
        eventTypeByte = this._lastEventTypeByte;
      } else {
        param = stream.readInt8();
        this._lastEventTypeByte = eventTypeByte;
      }
      eventType = eventTypeByte >> 4;
      channel = eventTypeByte & 0x0f;
      create_event = ChannelEventParser.events[eventType];
      if (create_event) {
        return create_event(param, stream, time);
      } else {
        return {
          type: "unknown",
          time: time,
          channel: channel
        };
      }
    };

    return ChannelEventParser;

  })(EventParser);
  SysEventParser = (function(_super) {
    __extends(SysEventParser, _super);

    function SysEventParser() {
      _ref2 = SysEventParser.__super__.constructor.apply(this, arguments);
      return _ref2;
    }

    SysEventParser.events = {
      0xf0: function(stream, time) {
        var length;

        length = stream.readVarInt();
        return new MIDI.Events.SysEx(stream.read(length), time);
      },
      0xf7: function(stream, time) {
        var length;

        length = stream.readVarInt();
        return new MIDI.Events.DividedSysEx(stream.read(length), time);
      }
    };

    SysEventParser.prototype.read = function(stream, time, eventTypeByte) {
      var create_event;

      create_event = SysEventParser.events[eventTypeByte];
      if (create_event) {
        return create_event(stream, time);
      } else {
        return {
          type: "unknown",
          time: time
        };
      }
    };

    return SysEventParser;

  })(EventParser);
  MIDIHeader = (function() {
    function MIDIHeader(midi_stream) {
      this.midi_stream = midi_stream;
    }

    MIDIHeader.prototype.read = function() {
      var header, header_chunk, header_stream;

      header_chunk = this.midi_stream.readChunk();
      if (header_chunk.id !== "MThd" || header_chunk.length !== 6) {
        throw "Bad .mid file - header not found";
      }
      header_stream = new Stream(header_chunk.data);
      header = {
        formatType: header_stream.readInt16(),
        trackCount: header_stream.readInt16(),
        ticksPerBeat: header_stream.readInt16()
      };
      if (header.ticksPerBeat & 0x8000) {
        throw "Expressing time division in SMTPE frames is not supported yet";
      }
      return header;
    };

    return MIDIHeader;

  })();
  MIDITracks = (function() {
    function MIDITracks(midi_stream, header) {
      this.midi_stream = midi_stream;
      this.header = header;
    }

    MIDITracks.prototype.read = function() {
      var i, track, track_chunk, track_id, track_stream, tracks, unexpected, _i, _ref3;

      tracks = [];
      for (i = _i = 0, _ref3 = this.header.trackCount - 1; 0 <= _ref3 ? _i <= _ref3 : _i >= _ref3; i = 0 <= _ref3 ? ++_i : --_i) {
        track = tracks[i] = [];
        track_chunk = this.midi_stream.readChunk();
        track_id = track_chunk.id;
        unexpected = track_id !== "MTrk";
        if (unexpected) {
          throw "Unexpected chunk. Expected MTrk, got " + track_id + ".";
        }
        track_stream = new Stream(track_chunk.data);
        while (!track_stream.eof()) {
          track.push(this.readNext(track_stream));
        }
      }
      return tracks;
    };

    MIDITracks.prototype.readNext = function(track_stream) {
      var e, eventTypeByte, parser, time;

      e = new Event(track_stream);
      time = track_stream.readVarInt();
      eventTypeByte = track_stream.readInt8();
      EventParser = this.getEventParserByType(eventTypeByte);
      parser = new EventParser();
      return parser.read(track_stream, time, eventTypeByte);
    };

    MIDITracks.prototype.getEventParserByType = function(eventTypeByte) {
      if ((eventTypeByte & 0xf0) !== 0xf0) {
        return ChannelEventParser;
      } else if (eventTypeByte === 0xff) {
        return MetaEventParser;
      } else {
        return SysEventParser;
      }
    };

    return MIDITracks;

  })();
  return MIDIParser = (function() {
    function MIDIParser(binaryString) {
      var header, header_parser, midi_stream, track_parser, tracks;

      midi_stream = new Stream(binaryString);
      header_parser = new MIDIHeader(midi_stream);
      header = header_parser.read();
      track_parser = new MIDITracks(midi_stream, header);
      tracks = track_parser.read();
      this.header = header;
      this.tracks = tracks;
    }

    return MIDIParser;

  })();
});

define('lib/writer',[],function() {
  var MIDIWriter;

  return MIDIWriter = (function() {
    function MIDIWriter(midi) {
      this.midi = midi;
    }

    MIDIWriter.prototype.write = function() {
      return JSON.stringify(this.midi);
    };

    return MIDIWriter;

  })();
});

define('main',['./lib/parser', './lib/writer', './lib/events'], function(Parser, Writer, Events) {
  var exports;

  exports = exports || window;
  return exports.MIDI = (function() {
    _Class.Writer = Writer;

    _Class.Parser = Parser;

    _Class.Events = Events;

    function _Class(header, tracks) {
      var decoded;

      if (typeof header === 'string') {
        decoded = new Parser(header);
        header = decoded.header;
        tracks = decoded.tracks;
      }
      this.header = header;
      this.tracks = tracks;
    }

    _Class.prototype.write = function() {
      var writer;

      writer = new Writer(this);
      return writer.write();
    };

    return _Class;

  })();
});
require(['main'], null, null, true); }(this));