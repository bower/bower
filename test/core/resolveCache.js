var path = require('path');
var mout = require('mout');
var rimraf = require('rimraf');
var fs = require('graceful-fs');
var Q = require('q');
var expect = require('expect.js');
var mkdirp = require('mkdirp');
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
        var oldFsRename = fs.rename;

        beforeEach(function (next) {
            // Restore oldFsRename
            fs.rename = oldFsRename;

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

        it('should overwrite if the exact same package source/version exists', function (next) {
            var cachePkgDir = path.join(cacheDir, md5('foo'), '1.0.0-rc.blehhh');

            mkdirp.sync(cachePkgDir);
            fs.writeFile(path.join(cachePkgDir, '_bleh'), 'w00t');

            resolveCache.store(tempPackage, {
                name: 'foo',
                version: '1.0.0-rc.blehhh',
                _source: 'foo',
                _target: '*'
            })
            .then(function (dir) {
                expect(dir).to.equal(cachePkgDir);
                expect(fs.existsSync(dir)).to.be(true);
                expect(fs.existsSync(path.join(dir, 'baz'))).to.be(true);
                expect(fs.existsSync(tempPackage)).to.be(false);
                expect(fs.existsSync(path.join(cachePkgDir, '_bleh'))).to.be(false);

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

        it('should move the canonical dir, even if it is in a different drive', function (next) {
            var hittedMock = false;

            fs.rename = function (src, dest, cb) {
                hittedMock = true;

                setTimeout(function () {
                    var err = new Error();
                    err.code = 'EXDEV';
                    cb(err);
                }, 10);
            };

            resolveCache.store(tempPackage, {
                name: 'foo',
                _source: 'foo',
                _target: 'some-branch'
            })
            .then(function (dir) {
                // Ensure mock was called
                expect(hittedMock).to.be(true);

                expect(dir).to.equal(path.join(cacheDir, md5('foo'), 'some-branch'));
                expect(fs.existsSync(dir)).to.be(true);
                expect(fs.existsSync(path.join(dir, 'baz'))).to.be(true);
                expect(fs.existsSync(tempPackage)).to.be(false);

                next();
            })
            .done();
        });
    });

    describe('.versions', function () {
        it('should resolve to an array', function (next) {
            resolveCache.versions(String(Math.random()))
            .then(function (versions) {
                expect(versions).to.be.an('array');
                next();
            })
            .done();
        });

        it('should ignore non-semver folders of the source', function (next) {
            var source = String(Math.random());
            var sourceId = md5(source);
            var sourceDir = path.join(cacheDir, sourceId);

            // Create some versions
            fs.mkdirSync(sourceDir);
            fs.mkdirSync(path.join(sourceDir, '0.0.1'));
            fs.mkdirSync(path.join(sourceDir, '0.1.0'));
            fs.mkdirSync(path.join(sourceDir, 'foo'));

            resolveCache.versions(source)
            .then(function (versions) {
                expect(versions).to.not.contain('foo');
                expect(versions).to.contain('0.0.1');
                expect(versions).to.contain('0.1.0');
                next();
            })
            .done();
        });

        it('should order the versions', function (next) {
            var source = String(Math.random());
            var sourceId = md5(source);
            var sourceDir = path.join(cacheDir, sourceId);

            // Create some versions
            fs.mkdirSync(sourceDir);
            fs.mkdirSync(path.join(sourceDir, '0.0.1'));
            fs.mkdirSync(path.join(sourceDir, '0.1.0'));
            fs.mkdirSync(path.join(sourceDir, '0.1.0-rc.1'));

            resolveCache.versions(source)
            .then(function (versions) {
                expect(versions).to.eql(['0.1.0', '0.1.0-rc.1', '0.0.1']);
                next();
            })
            .done();
        });

        it('should cache versions to speed-up subsequent calls', function (next) {
            var source = String(Math.random());
            var sourceId = md5(source);
            var sourceDir = path.join(cacheDir, sourceId);

            // Create some versions
            fs.mkdirSync(sourceDir);
            fs.mkdirSync(path.join(sourceDir, '0.0.1'));

            resolveCache.versions(source)
            .then(function () {
                // Remove folder
                rimraf.sync(sourceDir);

                return resolveCache.versions(source);
            })
            .then(function (versions) {
                expect(versions).to.eql(['0.0.1']);
                next();
            })
            .done();
        });
    });
});
