var assert  = require('assert');
var path    = require('path');
// var fs      = require('fs');
// var _       = require('lodash');
var Manager = require('../lib/core/manager');
var rimraf  = require('rimraf');
var config  = require('../lib/core/config');

describe('manager', function () {
  beforeEach(function (done) {
    rimraf(config.directory, function (err) {
      if (err) {
        throw new Error('Unable to delete local directory.');
      }
      done();
    });
  });

  it('Should resolve JSON dependencies', function (next) {
    var manager = new Manager([]);
    manager.cwd = __dirname + '/assets/project';

    manager.on('resolve', function () {
      assert.deepEqual(manager.dependencies["jquery-ui"][0].version, "1.8.23");
      assert.deepEqual(manager.dependencies["jquery"][0].version, "1.8.1");
      assert.deepEqual(manager.dependencies["package-bootstrap"][0].version, "2.0.6");

      rimraf(config.directory, function (err) {
        next();
      });
    });

    manager.resolve();

  });

  it('Should resolve nested JSON dependencies', function (next) {
    var manager = new Manager([]);
    manager.cwd = __dirname + '/assets/project-nested';

    manager.on('resolve', function () {
      assert.deepEqual(manager.dependencies["jquery"][0].version, "1.7.2");
      assert.deepEqual(manager.dependencies["jquery-pjax"][0].version, "1.0.0");

      rimraf(config.directory, function (err) {
        next();
      });
    });

    manager.resolve();
  });

  it('Should detect unresolvable packages in nested JSON dependencies', function (next) {
    var manager = new Manager([]);
    manager.cwd = __dirname + '/assets/project-nested-conflict';

    var detected = false;
    manager.on('error', function (err) {
      if (/no resolvable.* jquery$/i) detected = true;
    });
    manager.on('resolve', function () {
      if (!detected) throw new Error('A conflict in jquery should have been detected.');
      next();
    });

    manager.resolve();
  });
});
