var assert  = require('assert');
var path    = require('path');
// var fs      = require('fs');
// var _       = require('lodash');
var Manager = require('../lib/core/manager');

describe('manager', function () {
  it('Should resolve JSON dependencies', function (next) {
    var manager = new Manager([]);
    manager.cwd = __dirname + '/assets/project';

    manager.on('resolve', function () {
      assert.deepEqual(manager.dependencies["jquery-ui"][0].version, "1.8.23");
      assert.deepEqual(manager.dependencies["jquery"][0].version, "1.7.2");
      assert.deepEqual(manager.dependencies["package-bootstrap"][0].version, "2.0.6");
      next();
    });

    manager.resolve()
  });

  it('Should resolve nested JSON dependencies', function (next) {
    var manager = new Manager([]);
    manager.cwd = __dirname + '/assets/other-project';

    manager.on('resolve', function () {
      assert.deepEqual(manager.dependencies["jquery"][0].version, "1.7.2");
      assert.deepEqual(manager.dependencies["jquery-pjax"][0].version, "1.0.0");
      next();
    });

    manager.resolve()
  });
});
