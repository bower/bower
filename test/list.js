/*jshint plusplus: false */

var assert   = require('assert');
var rimraf   = require('rimraf');

var Manager  = require('../lib/core/manager');
var list     = require('../lib/commands/list');
var config   = require('../lib/core/config');

describe('list', function () {
  var savedConfigJson = config.json;

  function clean(done) {
    var del = 0;

    // Restore possibly dirtied config.json
    config.json = savedConfigJson;

    rimraf(config.directory, function () {
      // Ignore the error if the local directory was not actually deleted
      if (++del >= 2) done();
    });

    rimraf(config.cache, function () {
      // Ignore the error if the cache directory was not actually deleted
      if (++del >= 2) done();
    });
  }

  // function to normalize paths because in windows the separator is \\ instead of /
  function normalize(target) {
    var key,
        newObj;

    if (typeof target === 'string') {
      return target.replace(/\\/g, '/');
    }

    if (Array.isArray(target)) {
      return target.map(function (item) {
        return normalize(item);
      });
    }

    newObj = {};
    for (key in target) {
      newObj[key] = normalize(target[key]);
    }

    return newObj;
  }

  beforeEach(clean);
  after(clean);

  it('Should have line method', function () {
    assert(typeof list.line === 'function');
  });

  it('Should list paths', function (next) {
    // install project
    var manager = new Manager([]);
    manager.cwd = __dirname + '/assets/project-complex-nest';

    manager
      .on('error', function (err) {
        throw err;
      })
      .on('resolve', function () {
        list({ paths: true }).on('data', function (data) {
          assert.deepEqual(normalize(data), {
            a: ['bower_components/a/a.js', 'bower_components/a/a.css'],
            a1: 'bower_components/a1/a1.js',
            a2: [
              'bower_components/a2/a2.js',
              'bower_components/a2/a2.css',
              'bower_components/a2/a2.html'
            ],
            b: ['bower_components/b/b.js', 'bower_components/b/b.html'],
            b1: ['bower_components/b1/b1.js', 'bower_components/b1/b1.css'],
            c: 'bower_components/c/c.css'
          });

          next();
        });
      })
      .resolve();
  });

  it('Should list nested map', function (next) {
    // install project
    var manager = new Manager([]);
    manager.cwd = __dirname + '/assets/project-nested';

    manager
      .on('error', function (err) {
        throw err;
      })
      .on('resolve', function () {
        list({ map: true }).on('data', function (data) {
          assert(normalize(data), {
            jquery: {
              source: {
                main: 'bower_components/jquery/jquery.js'
              }
            },
            'jquery-pjax': {
              source: {
                main: 'bower_components/jquery-pjax/jquery.pjax.js'
              },
              dependencies: {
                jquery: {
                  source: {
                    main: 'bower_components/jquery/jquery.js'
                  }
                }
              }
            }
          });

          next();
        });
      })
      .resolve();
  });

  it('Should list sources in order, dependencies first', function (next) {
    // install project
    var manager = new Manager([]);
    manager.cwd = __dirname + '/assets/project-complex-nest';

    manager
      .on('error', function (err) {
        throw err;
      })
      .on('resolve', function () {
        list({ sources: true }).on('data', function (data) {
          assert.deepEqual(normalize(data), {
            '.js': [
              'bower_components/a1/a1.js',
              'bower_components/a2/a2.js',
              'bower_components/a/a.js',
              'bower_components/b1/b1.js',
              'bower_components/b/b.js'
            ],
            '.css': [
              'bower_components/a2/a2.css',
              'bower_components/a/a.css',
              'bower_components/b1/b1.css',
              'bower_components/c/c.css'
            ],
            '.html': [ 'bower_components/a2/a2.html', 'bower_components/b/b.html' ]
          });

          next();
        });
      })
      .resolve();
  });

});
