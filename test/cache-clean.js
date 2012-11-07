var glob       = require('glob');
var assert     = require('assert');
var rimraf     = require('rimraf');
var path       = require('path');
var fs         = require('fs');
var mkdirp     = require('mkdirp');
var config     = require('../lib/core/config');
var cacheClean = require('../lib/commands/cache-clean');

describe('cache-clean', function () {
  function clean(done) {
    var del = 0;

    rimraf(config.directory, function (err) {
      // Ignore the error if the local directory was not actually deleted
      if (++del >= 2) createCache(done);
    });

    rimraf(config.cache, function (err) {
      // Ignore the error if the cache directory was not actually deleted
      if (++del >= 2) createCache(done);
    });
  }

  beforeEach(clean);
  after(clean);

  function createCache(done) {
    mkdirp(config.cache, function (err) {
      if (err) throw new Error('Unable to create cache');
      done();
    });
  }

  function simulatePackage(name) {
    // Create some stuff in the cache to simulate
    var dir = path.join(config.cache, name);
    var someDir = path.join(dir, 'some-dir');

    fs.mkdirSync(dir);
    fs.mkdirSync(someDir);
    fs.writeFileSync(path.join(dir, 'some-file'), 'bower is awesome');
    fs.writeFileSync(path.join(someDir, 'some-other-file'), 'bower is fantastic');
  }

  it('Should clean the entire cache', function (next) {
    simulatePackage('some-package');
    simulatePackage('other-package');

    var cleaner = cacheClean();

    cleaner.on('error', function (err) {
      throw new Error(err);
    });

    cleaner.on('end', function () {
      glob(config.cache + '/*', function (err, dirs) {
        if (err) throw new Error(err);
        assert(dirs.length === 0);
        next();
      });
    });
  });

  it('Should clean only the selected packages', function (next) {
    simulatePackage('foo-package');
    simulatePackage('bar-package');
    simulatePackage('baz-package');

    var cleaner = cacheClean(['foo-package', 'bar-package']);

    cleaner.on('error', function (err) {
      throw new Error(err);
    });

    cleaner.on('end', function () {
      glob(config.cache + '/*', function (err, dirs) {
        if (err) throw new Error(err);
        dirs = dirs.map(function (dir) {
          return path.basename(dir);
        });

        assert.deepEqual(dirs, ['baz-package']);
        next();
      });
    });
  });

  it('Should throw error on unknown package', function (next) {
    var cleaner = cacheClean(['not-cached-package']);

    cleaner.on('error', function (err) {
      if (/not\-cached\-package/.test(err)) next();
    });

    cleaner.on('end', function () {
      throw new Error('Should have thrown an error.');
    });
  });

  it('Should handle passing duplicate package names', function (next) {
    simulatePackage('foo-package');
    simulatePackage('bar-package');

    var cleaner = cacheClean(['foo-package', 'foo-package', 'bar-package']);

    cleaner.on('error', function (err) {
      throw new Error(err);
    });

    cleaner.on('end', function () {
      glob(config.cache + '/*', function (err, dirs) {
        if (err) throw new Error(err);
        assert(dirs.length === 0);
        next();
      });
    });
  });

});