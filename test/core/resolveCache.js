var path = require('path');
var mout = require('mout');
var rimraf = require('rimraf');
var fs = require('graceful-fs');
var Q = require('q');
var expect = require('expect.js');
var ResolveCache = require('../../lib/core/ResolveCache');
var defaultConfig = require('../../lib/config');
var cmd = require('../../lib/util/cmd');
var copy = require('../../lib/util/copy');
var md5 = require('../../lib/util/md5');

describe('ResolveCache', function () {
    var resolveCache;
    var testPackage = path.resolve(__dirname, '../assets/github-test-package');
    var tempPackage = path.resolve(__dirname, '../assets/temp');
    var cacheDir = path.join(__dirname, '../assets/resolve-cache');

    before(function (next) {
        resolveCache = new ResolveCache(mout.object.deepMixIn(defaultConfig, {
            storage: {
                packages: cacheDir
            }
        }));

        // Checkout test package version 0.2.0
        cmd('git', ['checkout', '0.2.0'], { cwd: testPackage })
        .then(next.bind(next, null), next);
    });

    after(function () {
        rimraf.sync(cacheDir);
    });

    describe('.constructor', function () {

    });

    describe('.store', function () {
        beforeEach(function (next) {
            // Create a fresh copy of the test package into temp
            rimraf.sync(tempPackage);
            copy.copyDir(testPackage, tempPackage)
            .then(next.bind(next, null), next);
        });

        it('should move the canonical dir to source-md5/version/ folder if package meta has a version', function (next) {
            resolveCache.store(tempPackage, {
                name: 'foo',
                version: '1.0.0',
                _source: 'foo',
                _target: '*'
            })
            .then(function (dir) {
                expect(dir).to.equal(path.join(cacheDir, md5('foo'), '1.0.0'));
                expect(fs.existsSync(dir)).to.be(true);
                expect(fs.existsSync(path.join(dir, 'baz'))).to.be(true);
                expect(fs.existsSync(tempPackage)).to.be(false);

                next();
            })
            .done();
        });

        it('should move the canonical dir to source-md5/target/ folder if package meta has no version', function (next) {
            resolveCache.store(tempPackage, {
                name: 'foo',
                _source: 'foo',
                _target: 'some-branch'
            })
            .then(function (dir) {
                expect(dir).to.equal(path.join(cacheDir, md5('foo'), 'some-branch'));
                expect(fs.existsSync(dir)).to.be(true);
                expect(fs.existsSync(path.join(dir, 'baz'))).to.be(true);
                expect(fs.existsSync(tempPackage)).to.be(false);

                next();
            })
            .done();
        });

        it('should move the canonical dir to source-md5/_wildcard/ folder if package meta has no version and target is *', function (next) {
            resolveCache.store(tempPackage, {
                name: 'foo',
                _source: 'foo',
                _target: '*'
            })
            .then(function (dir) {
                expect(dir).to.equal(path.join(cacheDir, md5('foo'), '_wildcard'));
                expect(fs.existsSync(dir)).to.be(true);
                expect(fs.existsSync(path.join(dir, 'baz'))).to.be(true);
                expect(fs.existsSync(tempPackage)).to.be(false);

                next();
            })
            .done();
        });

        it('should read the package meta if not present', function (next) {
            var pkgMeta = path.join(tempPackage, '.bower.json');

            // Copy bower.json to .bower.json and add some props
            copy.copyFile(path.join(tempPackage, 'component.json'), pkgMeta)
            .then(function () {
                return Q.nfcall(fs.readFile, pkgMeta)
                .then(function (contents) {
                    var json = JSON.parse(contents.toString());

                    json._target = '~0.2.0';
                    json._source = 'git://github.com/bower/test-package.git';

                    return Q.nfcall(fs.writeFile, pkgMeta, JSON.stringify(json, null, '  '));
                });
            })
            // Store as usual
            .then(function () {
                return resolveCache.store(tempPackage);
            })
            .then(function (dir) {
                expect(dir).to.equal(path.join(cacheDir, md5('git://github.com/bower/test-package.git'), '0.2.0'));
                expect(fs.existsSync(dir)).to.be(true);
                expect(fs.existsSync(path.join(dir, 'baz'))).to.be(true);
                expect(fs.existsSync(tempPackage)).to.be(false);

                next();
            })
            .done();
        });

        it('should error out when reading the package meta if the file does not exist', function (next) {
            resolveCache.store(tempPackage)
            .then(function () {
                next(new Error('Should have failed'));
            }, function (err) {
                expect(err).to.be.an(Error);
                expect(err.code).to.equal('ENOENT');
                expect(err.message).to.contain(path.join(tempPackage, '.bower.json'));

                next();
            })
            .done();
        });

        it('should error out when reading an invalid package meta', function (next) {
            var pkgMeta = path.join(tempPackage, '.bower.json');

            return Q.nfcall(fs.writeFile, pkgMeta, 'w00t')
            .then(function () {
                return resolveCache.store(tempPackage)
                .then(function () {
                    next(new Error('Should have failed'));
                }, function (err) {
                    expect(err).to.be.an(Error);
                    expect(err.code).to.equal('EMALFORMED');
                    expect(err.message).to.contain(path.join(tempPackage, '.bower.json'));

                    next();
                });
            })
            .done();
        });

        it.skip('should move the canonical dir, even if it is in a different drive');
    });
});