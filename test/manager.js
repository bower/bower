var assert  = require('assert');
var path    = require('path');
// var fs      = require('fs');
// var _       = require('lodash');
var Manager = require('../lib/core/manager');
var rimraf  = require('rimraf');
var config  = require('../lib/core/config');

describe('manager', function () {
  it('Should resolve JSON dependencies', function (next) {
    var manager = new Manager([]);
    manager.cwd = __dirname + '/assets/project';

    manager.on('resolve', function () {
      assert.deepEqual(manager.dependencies["jquery-ui"][0].version, "1.8.23");
      assert.deepEqual(manager.dependencies["jquery"][0].version, "1.7.2");
      assert.deepEqual(manager.dependencies["package-bootstrap"][0].version, "2.0.6");

      rimraf(config.directory, function(err){
        next();
      });
    });

    // This package actually has a conflict in versions..
    // jquery-ui requires jquery^#1.8.x but the project package requires jquery#1.7.2
    // We ignore the error because the conflict will be solved with the lower version
    // Conflicts are tested in a test bellow
    manager.on('error', function (err) {});

    manager.resolve();

  });

  it('Should resolve nested JSON dependencies', function (next) {
    var manager = new Manager([]);
    manager.cwd = __dirname + '/assets/other-project';

    manager.on('resolve', function () {
      assert.deepEqual(manager.dependencies["jquery"][0].version, "1.7.2");
      assert.deepEqual(manager.dependencies["jquery-pjax"][0].version, "1.0.0");

      rimraf(config.directory, function(err){
        next();
      });
    });

    manager.resolve();
  });

  it('Should detect conflicts in nested JSON dependencies', function (next) {
    after(function () {
      rimraf(config.directory, function(err){
        next();
      });
    });

    var manager = new Manager([]);
    manager.cwd = __dirname + '/assets/conflict-project';

    var ok = 0;
    manager.on('error', function (err) {
      if (/jquery#/.test(err)) ok++;
      if (/conflict/i.test(err)) ok++;
    });
    manager.on('resolve', function () {
      if (ok < 2) throw new Error('A conflict in jquery should have been detected.');
      next();
    });

    manager.resolve();
  });
});
