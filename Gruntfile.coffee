nconf = require('nconf')
_ = require('underscore')

defaults =
  src: 'src'         # --src=src
  staging: 'staging' # --staging=staging
  dist: 'dist'       # --dist=dist

nconf
  .argv()
  .env()
  .defaults(defaults)

module.exports = (grunt) ->
  src = nconf.get('src')
  staging = nconf.get('staging')
  dist = nconf.get('dist')

  loadTasks = (tasks) ->
    for task in tasks
      grunt.loadNpmTasks task

  loadTasks [
    'grunt-contrib-clean',
    'grunt-contrib-coffee',
    'grunt-requirejs',
    'grunt-regarde']

  rjs_options = (options) ->
    defaults = 
      baseUrl: "#{staging}"
      almond: true
      include: ["main"]
      out: "#{dist}/midi.js"
      optimize: "none"
      # using this wrapper gives us
      # a: the ability to export objects safely in Node or the browser
      # b: forces synchronous loading of modules, so they are assigned
      #    before anyone attempts to access them.
      wrap:
        start: '(function(exports) {'
        end: 'require([\'main\'], null, null, true); }(this));'
    _.extend defaults, options

  grunt.initConfig

    clean:
      staging: ["#{staging}/*"]
      dist: ["#{dist}/*"]

    coffee: 
      compile: 
        expand: true
        cwd: "#{src}"
        src: ["**/*.coffee"]
        dest: "#{staging}"
        ext: '.js'
        options:
          bare: true

    requirejs:
      dev:
        options: rjs_options()
      dist:
        options: rjs_options(
          out: "#{dist}/midi.min.js",
          optimize: "uglify",
          preserveLicenseComments: false)

    regarde: 
      coffee: 
        files: ["#{src}/**/*.coffee"]
        tasks: ["coffee:compile:change", "requirejs"]

  createChangeTask = (task, target) ->
    grunt.registerTask "#{task}:#{target}:change", ->
      conf = grunt.config
      cwd = "#{task}.#{target}.cwd"
      src = "#{task}.#{target}.src"
      dir = conf.get cwd
      files = grunt.regarde.changed

      conf.set src, files.map (changed) ->
        changed.split(dir)[1].slice(1)
        
      grunt.option 'force', true
      grunt.task.run "#{task}:#{target}"

  createChangeTask 'coffee', 'compile'

  grunt.registerTask 'build', [
    'clean',
    'coffee:compile',
    'requirejs']

  grunt.registerTask 'default', [
    'build',
    'regarde']