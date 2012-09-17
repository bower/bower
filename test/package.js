var assert  = require('assert');
var path    = require('path');
var fs      = require('fs');
var _       = require('lodash');
var rimraf   = require('rimraf');
var config   = require('../lib/core/config');
var Package = require('../lib/core/package');

describe('package', function () {
  it('Should resolve git URLs properly', function () {
    var pkg = new Package('jquery', 'git://github.com/jquery/jquery.git');
    assert.equal(pkg.gitUrl, 'git://github.com/jquery/jquery.git');
  });

  it('Should resolve git HTTP URLs properly', function () {
    var pkg = new Package('jquery', 'git+http://example.com/project.git');
    assert.equal(pkg.gitUrl, 'http://example.com/project.git');
  });

  it('Should resolve git HTTPS URLs properly', function () {
    var pkg = new Package('jquery', 'git+https://example.com/project.git');
    assert.equal(pkg.gitUrl, 'https://example.com/project.git');
  });

  it('Should resolve git URL tags', function () {
    var pkg = new Package('jquery', 'git://github.com/jquery/jquery.git#v1.0.1');
    assert.equal(pkg.tag, 'v1.0.1');
  });

  it('Should resolve github urls', function () {
    var pkg = new Package('jquery', 'git@github.com:twitter/flight.git#v1.0.1');
    assert.equal(pkg.tag, 'v1.0.1');
    assert.equal(pkg.gitUrl, 'git@github.com:twitter/flight.git');
  });

  it('Should resolve paths properly', function () {
    var pkg = new Package('jquery', '~/jquery');
    assert.equal(pkg.path, path.resolve('~/jquery'));
  });

  it('Should clone git packages', function (next) {
    var pkg = new Package('jquery', 'git://github.com/maccman/package-jquery.git');

    pkg.on('resolve', function () {
      assert(pkg.path);
      assert(fs.existsSync(pkg.path));
      next();
    });

    pkg.on('error', function (err) {
      throw new Error(err);
    });

    pkg.clone();
  });

  it('Should copy path packages', function (next) {
    var pkg = new Package('jquery', __dirname + '/assets/package-jquery');

    pkg.on('resolve', function () {
      assert(pkg.path);
      assert(fs.existsSync(pkg.path));
      next();
    });

    pkg.on('error', function (err) {
      throw new Error(err);
    });

    pkg.copy();
  });

  it('Should error on clone fail', function (next) {
    var pkg = new Package('random', 'git://example.com');

    pkg.on('error', function (err) {
      assert(err);
      next();
    });

    pkg.clone();
  });

  it('Should load correct json', function (next) {
    var pkg = new Package('jquery', __dirname + '/assets/package-jquery');

    pkg.on('loadJSON', function () {
      assert(pkg.json);
      assert.equal(pkg.json.name, 'jquery');
      next();
    });

    pkg.loadJSON();
  });

  it('Should resolve JSON dependencies', function (next) {
    var pkg = new Package('project', __dirname + '/assets/project');

    pkg.on('resolve', function () {
      var deps = _.pluck(pkg.getDeepDependencies(), 'name');
      assert.deepEqual(_.uniq(deps), ["package-bootstrap", "jquery-ui", "jquery"]);
      next();
    });

    pkg.resolve();
  });

  it('Should error when copying fails from non existing path', function (next) {
    var pkg = new Package('project', __dirname + '/assets/project-non-existent');

    pkg.on('error', function (err) {
      assert(err);
      next();
    });

    pkg.resolve();
  });

  it('Should copy files from temp folder to local path', function (next) {
    var pkg = new Package('jquery', 'git://github.com/maccman/package-jquery.git');

    pkg.on('resolve', function () {
      pkg.install();
    });
    pkg.on('install',function () {
      assert(fs.existsSync(pkg.localPath));
      rimraf(config.directory, function(err){
        next();
      });
    });
    pkg.clone();
  });
});