/*jshint plusplus: false */

var assert   = require('assert');
var rimraf   = require('rimraf');

var Manager  = require('../lib/core/manager');
var list     = require('../lib/commands/list');
var config   = require('../lib/core/config');

describe('list', function () {
  var savedConfigJson = config.json;

  // console.log( config );

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
    assert(!!list.line);
  });

  it('Should install', function (next) {
    // install project
    var manager = new Manager([]);
    manager.cwd = __dirname + '/assets/project-complex-nest';

    manager
      .on('resolve', function () {
        list({ sources: true}).on('data', function (data) {
          console.log('got datas');
          console.log(data);
          clean(next);
        });
      })
      .resolve();

  });


});
