var assert  = require('assert');
var path    = require('path');
var fs      = require('fs');
var nock    = require('nock');
var _       = require('lodash');
var rimraf  = require('rimraf');
var async   = require('async');
var config  = require('../lib/core/config');
var Package = require('../lib/core/package');

describe('package', function () {

  function clean(done) {
    var del = 0;

    rimraf(config.directory, function (err) {
      // Ignore the error if the local directory was not actually deleted
      if (++del >= 2) done();
    });

    rimraf(config.cache, function (err) {
      // Ignore the error if the cache directory was not actually deleted
      if (++del >= 2) done();
    });
  }

  beforeEach(clean);
  after(clean);

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

  it('Should resolve url when we got redirected', function (next) {
    var redirecting_url    = 'http://redirecting-url.com';
    var redirecting_to_url = 'http://redirected-to-url.com';

    var redirect_scope = nock(redirecting_url)
      .defaultReplyHeaders({'location': redirecting_to_url + '/jquery.zip'})
      .get('/jquery.zip')
      .reply(302);

    var redirect_to_scope = nock(redirecting_to_url)
      .get('/jquery.zip')
      .reply(200, 'jquery content');

    var pkg = new Package('jquery', redirecting_url + '/jquery.zip');

    pkg.on('resolve', function () {
      assert(pkg.assetUrl);
      assert.equal(pkg.assetUrl, redirecting_to_url + '/jquery.zip');
      nock.restore();
      next();
    });

    pkg.on('error', function (err) {
      throw new Error(err);
    });

    pkg.download();
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

    pkg.on('error', function (err) {
      throw new Error(err);
    });

    pkg.loadJSON();
  });

  it('Should not fallback to package.json if there is an error in the components.json', function (next) {
    var pkg = new Package('jquery', __dirname + '/assets/package-invalid-json');

    pkg.on('error', function (error) {
      if (/parse json/i.test(error)) next();
      else throw new Error(err);
    });
    pkg.on('loadJSON', function () {
      throw new Error('Should have throw an error parsing the JSON.');
    });

    pkg.loadJSON();
  });

  it('Should resolve JSON dependencies', function (next) {
    var pkg = new Package('project', __dirname + '/assets/project');

    pkg.on('resolve', function () {
      var deps = _.pluck(pkg.getDeepDependencies(), 'name');
      assert.deepEqual(_.uniq(deps), ['package-bootstrap', 'jquery-ui', 'jquery']);
      next();
    });

    pkg.on('error', function (err) {
      throw new Error(err);
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

    pkg.on('error', function (err) {
      throw new Error(err);
    });

    pkg.on('install',function () {
      assert(fs.existsSync(pkg.localPath));
      rimraf(config.directory, function(err){
        next();
      });
    });

    pkg.clone();
  });

  it('Should have accessible file permissions on temp folder', function (next) {
    var pkg = new Package('jquery', 'git://github.com/maccman/package-jquery.git');
    var cachePath;

    pkg.on('cache', function() {
      cachePath = pkg.path;
    });

    pkg.on('resolve', function () {
      pkg.install();
    });

    pkg.on('error', function (err) {
      throw new Error(err);
    });

    pkg.on('install',function () {
      async.map([pkg.localPath, cachePath], fs.stat, function (err, results) {
        if (err) throw new Error(err);
        assert.equal(results[0].mode, results[1].mode);
        next();
      });
    });

    pkg.on('error', function (err) {
      throw new Error(err);
    });

    pkg.clone();
  });

});
