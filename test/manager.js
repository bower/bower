var assert  = require('assert');
var path    = require('path');
// var fs      = require('fs');
// var _       = require('lodash');
var Manager = require('../lib/core/manager');
var rimraf  = require('rimraf');
var config  = require('../lib/core/config');
var semver  = require('semver');
var fs      = require('fs');
var path    = require('path');

describe('manager', function () {
  beforeEach(function (done) {
    if (fs.existsSync(config.directory)) {
      rimraf(config.directory, function (err) {
        if (err) {
          throw new Error('Unable to delete local directory.');
        }
        done();
      });
    } else done();
  });

  it('Should resolve JSON dependencies', function (next) {
    var manager = new Manager([]);
    manager.cwd = __dirname + '/assets/project';

    manager.on('resolve', function () {
      assert.ok(semver.gte(manager.dependencies['jquery'][0].version, '1.8.1'));
      assert.ok(semver.gte(manager.dependencies['package-bootstrap'][0].version, '2.0.0'));
      assert.ok(semver.gte(manager.dependencies['jquery-ui'][0].version, '1.8.0'));
      next();
    });

    manager.resolve();

  });

  it('Should resolve nested JSON dependencies', function (next) {
    var manager = new Manager([]);
    manager.cwd = __dirname + '/assets/project-nested';

    manager.on('resolve', function () {
      assert.deepEqual(manager.dependencies['jquery'][0].version, '1.7.2');
      assert.deepEqual(manager.dependencies['jquery-pjax'][0].version, '1.0.0');
      next();
    });

    manager.resolve();
  });

  it('Should override packages at the project level', function (next) {
    var manager = new Manager([]);
    manager.cwd = __dirname + '/assets/project-static';

    manager.on('resolve', function () {
      assert.deepEqual(manager.dependencies['jquery'][0].version, '1.8.1');
      assert.deepEqual(manager.dependencies['jquery-pjax'][0].version, '1.0.0');
      assert.ok(fs.existsSync(path.join(manager.dependencies['jquery'][0].localPath, 'foo.js')));
      next();
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

  it('Should install components to the specified components directory', function (next) {
    var manager = new Manager([]);
    manager.cwd = __dirname + '/assets/project-custom-directory';

    before(function (done) {
      rimraf(manager.opts.directory, function (err) {
        if (err) {
          throw new Error('Unable to delete local directory.');
        }
        done();
      });
    });

    manager.on('resolve', function () {
      assert.ok(fs.existsSync(manager.opts.directory));
      next();
    });

    manager.resolve();
  });

});
