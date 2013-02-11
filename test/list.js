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

  it('Should have line method', function () {
    assert(typeof list.line === 'function');
  });

  it('Should list paths', function (next) {
    // install project
    var manager = new Manager([]);
    manager.cwd = __dirname + '/assets/project-complex-nest';

    manager
      .on('resolve', function () {
        list({ paths: true }).on('data', function (data) {
          assert.deepEqual(data, {
            a: ['components/a/a.js', 'components/a/a.css'],
            a1: 'components/a1/a1.js',
            a2: [
              'components/a2/a2.js',
              'components/a2/a2.css',
              'components/a2/a2.html'
            ],
            b: ['components/b/b.js', 'components/b/b.html'],
            b1: ['components/b1/b1.js', 'components/b1/b1.css'],
            c: 'components/c/c.js'
          });
          clean(next);
        });
      })
      .resolve();
  });

  it('Should list nested map', function (next) {
    // install project
    var manager = new Manager([]);
    manager.cwd = __dirname + '/assets/project-nested';

    manager
      .on('resolve', function () {
        list({ map: true }).on('data', function (data) {
          assert(data, {
            jquery: {
              source: {
                main: 'components/jquery/jquery.js'
              }
            },
            'jquery-pjax': {
              source: {
                main: 'components/jquery-pjax/jquery.pjax.js'
              },
              dependencies: {
                jquery: {
                  source: {
                    main: 'components/jquery/jquery.js'
                  }
                }
              }
            }
          });
          clean(next);
        });
      })
      .resolve();
  });

  it('Should list sources in order, dependencies first', function (next) {
    // install project
    var manager = new Manager([]);
    manager.cwd = __dirname + '/assets/project-complex-nest';

    manager
      .on('resolve', function () {
        list({ sources: true }).on('data', function (data) {
          assert.deepEqual(data, {
            '.js': [
              'components/a1/a1.js',
              'components/a2/a2.js',
              'components/a/a.js',
              'components/b1/b1.js',
              'components/b/b.js',
              'components/c/c.js'
            ],
            '.css': [
              'components/a2/a2.css',
              'components/a/a.css',
              'components/b1/b1.css'
            ],
            '.html': [ 'components/a2/a2.html', 'components/b/b.html' ]
          });
          clean(next);
        });
      })
      .resolve();
  });

});
