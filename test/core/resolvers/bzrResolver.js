var expect = require('expect.js');
var util = require('util');
var path = require('path');
var fs = require('graceful-fs');
var chmodr = require('chmodr');
var rimraf = require('rimraf');
var mkdirp = require('mkdirp');
var Q = require('q');
var mout = require('mout');
var Logger = require('bower-logger');
var copy = require('../../../lib/util/copy');
var BzrResolver = require('../../../lib/core/resolvers/BzrResolver');
var defaultConfig = require('../../../lib/config');

describe('BzrResolver', function () {
    var tempDir = path.resolve(__dirname, '../../assets/tmp');
    var testPackage = path.resolve(__dirname, '../../assets/package-bzr');
    var originaltags = BzrResolver.tags;
    var logger;

    before(function () {
        logger = new Logger();
    });

    afterEach(function () {
        logger.removeAllListeners();
    });

    function clearResolverRuntimeCache() {
        BzrResolver.tags = originaltags;
        BzrResolver.clearRuntimeCache();
    }

    function create(decEndpoint, config) {
        if (typeof decEndpoint === 'string') {
            decEndpoint = { source: decEndpoint };
        }

        return new BzrResolver(decEndpoint, config || defaultConfig, logger);
    }

    describe('misc', function () {
        it.skip('should error out if bzr is not installed');
        it.skip('should setup bzr template dir to an empty folder');
    });

    describe('.hasNew', function () {
        before(function () {
            mkdirp.sync(tempDir);
        });

        afterEach(function (next) {
            clearResolverRuntimeCache();
            rimraf(path.join(tempDir, '.bower.json'), next);
        });

        after(function (next) {
            rimraf(tempDir, next);
        });


        it('should be true when the resolution type is different', function (next) {
            var resolver;

            fs.writeFileSync(path.join(tempDir, '.bower.json'), JSON.stringify({
                name: 'foo',
                version: '0.0.0',
                _resolution: {
                    type: 'version',
                    tag: '0.0.0',
                    commit: 123
                }
            }));
            BzrResolver.tags = function () {
                return Q.resolve({
                    'boo': 123  // same commit hash on purpose
                });
            };

            resolver = create('foo');
            resolver.hasNew(tempDir)
            .then(function (hasNew) {
                expect(hasNew).to.be(true);
                next();
            })
            .done();
        });

        it('should be true when a higher version for a range is available', function (next) {
            var resolver;

            fs.writeFileSync(path.join(tempDir, '.bower.json'), JSON.stringify({
                name: 'foo',
                version: '1.0.0',
                _resolution: {
                    type: 'version',
                    tag: '1.0.0',
                    commit: 3
                }
            }));
            BzrResolver.tags = function () {
                return Q.resolve({
                    '1.0.0': 2,
                    '1.0.1': 2  // same commit hash on purpose
                });
            };

            resolver = create('foo');
            resolver.hasNew(tempDir)
            .then(function (hasNew) {
                expect(hasNew).to.be(true);
                next();
            })
            .done();
        });

        it('should be true when a resolved to a lower version of a range', function (next) {
            var resolver;

            fs.writeFileSync(path.join(tempDir, '.bower.json'), JSON.stringify({
                name: 'foo',
                version: '1.0.1',
                _resolution: {
                    type: 'version',
                    tag: '1.0.1',
                    commit: 3
                }
            }));
            BzrResolver.tags = function () {
                return Q.resolve({
                    '1.0.0': 2
                });
            };

            resolver = create('foo');
            resolver.hasNew(tempDir)
            .then(function (hasNew) {
                expect(hasNew).to.be(true);
                next();
            })
            .done();
        });

        it('should be false when resolved to the same tag (with same commit hash) for a given range', function (next) {
            var resolver;

            fs.writeFileSync(path.join(tempDir, '.bower.json'), JSON.stringify({
                name: 'foo',
                version: '1.0.1',
                _resolution: {
                    type: 'version',
                    tag: '1.0.1',
                    commit: 2
                }
            }));
            BzrResolver.tags = function () {
                return Q.resolve({
                    '1.0.0': 1,
                    '1.0.1': 2
                });
            };

            resolver = create('foo');
            resolver.hasNew(tempDir)
            .then(function (hasNew) {
                expect(hasNew).to.be(false);
                next();
            })
            .done();
        });

        it('should be true when resolved to the same tag (with different commit hash) for a given range', function (next) {
            var resolver;

            fs.writeFileSync(path.join(tempDir, '.bower.json'), JSON.stringify({
                name: 'foo',
                version: '1.0.1',
                _resolution: {
                    type: 'version',
                    tag: '1.0.1',
                    commit: 3
                }
            }));
            BzrResolver.tags = function () {
                return Q.resolve({
                    '1.0.0': 2,
                    '1.0.1': 4
                });
            };

            resolver = create('foo');
            resolver.hasNew(tempDir)
            .then(function (hasNew) {
                expect(hasNew).to.be(true);
                next();
            })
            .done();
        });


        it('should be false when targeting commit hashes', function (next) {
            var resolver;

            fs.writeFileSync(path.join(tempDir, '.bower.json'), JSON.stringify({
                name: 'foo',
                _resolution: {
                    type: 'revno',
                    commit: 1
                }
            }));
            BzrResolver.tags = function () {
                return Q.resolve({
                    '1.0.0': 2
                });
            };

            resolver = create('foo');
            resolver.hasNew(tempDir)
            .then(function (hasNew) {
                expect(hasNew).to.be(true);
                next();
            })
            .done();
        });
    });

    describe('._resolve', function () {
        afterEach(clearResolverRuntimeCache);

        it('should call the necessary functions by the correct order', function (next) {
            var resolver;

            function DummyResolver() {
                BzrResolver.apply(this, arguments);
                this._stack = [];
            }

            util.inherits(DummyResolver, BzrResolver);
            mout.object.mixIn(DummyResolver, BzrResolver);

            DummyResolver.prototype.getStack = function () {
                return this._stack;
            };

            DummyResolver.tags  = function () {
                return Q.resolve({
                    '1.0.0': 1
                });
            };

            DummyResolver.prototype.resolve = function () {
                this._stack = [];
                return BzrResolver.prototype.resolve.apply(this, arguments);
            };

            DummyResolver.prototype._findResolution = function () {
                this._stack.push('before _findResolution');
                return BzrResolver.prototype._findResolution.apply(this, arguments)
                .then(function (val) {
                    this._stack.push('after _findResolution');
                    return val;
                }.bind(this));
            };

            DummyResolver.prototype._checkout = function () {
                this._stack.push('before _checkout');
                return Q.resolve()
                .then(function (val) {
                    this._stack.push('after _checkout');
                    return val;
                }.bind(this));
            };

            DummyResolver.prototype._cleanup = function () {
                this._stack.push('before _cleanup');
                return BzrResolver.prototype._cleanup.apply(this, arguments)
                .then(function (val) {
                    this._stack.push('after _cleanup');
                    return val;
                }.bind(this));
            };

            resolver = new DummyResolver({ source: 'foo', target: '1.0.0' }, defaultConfig, logger);

            resolver.resolve()
            .then(function () {
                expect(resolver.getStack()).to.eql([
                    'before _findResolution',
                    'after _findResolution',
                    'before _checkout',
                    'after _checkout',
                    'before _cleanup',
                    'after _cleanup'
                ]);
                next();
            })
             .done();
        });

    });

    describe('._findResolution', function () {
        afterEach(clearResolverRuntimeCache);

        it('should resolve to an object', function (next) {
            var resolver;

            BzrResolver.tags = function () {
                return Q.resolve({});
            };

            resolver = create('foo');
            resolver._findResolution('*')
            .then(function (resolution) {
                expect(resolution).to.be.an('object');
                next();
            })
            .done();
        });

        it('should resolve "*" to the latest revno if a repository has no valid semver tags', function (next) {
            var resolver;

            BzrResolver.tags = function () {
                return Q.resolve({
                    'some-tag': 1
                });
            };

            resolver = create('foo');
            resolver._findResolution('*')
            .then(function (resolution) {
                expect(resolution).to.eql({
                    type: 'revno',
                    commit: '-1'
                });
                next();
            })
            .done();
        });

        it('should resolve "*" to the latest version if a repository has valid semver tags, ignoring pre-releases', function (next) {
            var resolver;

            BzrResolver.tags = function () {
                return Q.resolve({
                    '0.1.0': 1,
                    'v0.1.1': 2,
                    '0.2.0-rc.1': 3   // Should ignore release candidates
                });
            };

            resolver = create('foo');
            resolver._findResolution('*')
            .then(function (resolution) {
                expect(resolution).to.eql({
                    type: 'version',
                    tag: 'v0.1.1',
                    commit: 2
                });
                next();
            })
            .done();
        });

        it('should resolve "*" to the latest version if a repository has valid semver tags, not ignoring pre-releases if they are the only versions', function (next) {
            var resolver;

            BzrResolver.tags = function () {
                return Q.resolve({
                    '0.1.0-rc.1': 1,
                    '0.1.0-rc.2': 2
                });
            };

            resolver = create('foo');
            resolver._findResolution('*')
            .then(function (resolution) {
                expect(resolution).to.eql({
                    type: 'version',
                    tag: '0.1.0-rc.2',
                    commit: 2
                });
                next();
            })
            .done();
        });

        it('should resolve to the latest version that matches a range/version', function (next) {
            var resolver;

            BzrResolver.tags = function () {
                return Q.resolve({
                    '0.1.0': 1,
                    'v0.1.1': 2,
                    '0.2.0': 3,
                    'v0.2.1': 4
                });
            };

            resolver = create('foo');
            resolver._findResolution('~0.2.0')
            .then(function (resolution) {
                expect(resolution).to.eql({
                    type: 'version',
                    tag: 'v0.2.1',
                    commit: 4
                });
                next();
            })
            .done();
        });

        it('should resolve to a tag even if target is a range that does not exist', function (next) {
            var resolver;

            BzrResolver.tags = function () {
                return Q.resolve({
                    '1.0': 1
                });
            };

            resolver = create('foo');
            resolver._findResolution('1.0')
            .then(function (resolution) {
                expect(resolution).to.eql({
                    type: 'tag',
                    tag: '1.0',
                    commit: 1
                });
                next();
            })
            .done();
        });

        it('should resolve to the latest pre-release version that matches a range/version', function (next) {
            var resolver;

            BzrResolver.tags = function () {
                return Q.resolve({
                    '0.1.0': 1,
                    'v0.1.1': 2,
                    '0.2.0': 3,
                    'v0.2.1-rc.1': 4
                });
            };

            resolver = create('foo');
            resolver._findResolution('~0.2.1')
            .then(function (resolution) {
                expect(resolution).to.eql({
                    type: 'version',
                    tag: 'v0.2.1-rc.1',
                    commit: 4
                });
                next();
            })
            .done();
        });

        it('should resolve to the exact version if exists', function (next) {
            var resolver;

            BzrResolver.tags = function () {
                return Q.resolve({
                    '0.8.1' : 1,
                    '0.8.1+build.1': 2,
                    '0.8.1+build.2': 3,
                    '0.8.1+build.3': 4
                });
            };

            resolver = create('foo');
            resolver._findResolution('0.8.1+build.2')
            .then(function (resolution) {
                expect(resolution).to.eql({
                    type: 'version',
                    tag: '0.8.1+build.2',
                    commit: 3
                });
                next();
            })
            .done();
        });

        it('should fail to resolve if none of the versions matched a range/version', function (next) {
            var resolver;

            BzrResolver.tags = function () {
                return Q.resolve({
                    '0.1.0': 1,
                    'v0.1.1': 2
                });
            };

            resolver = create('foo');
            resolver._findResolution('~0.2.0')
            .then(function () {
                next(new Error('Should have failed'));
            }, function (err) {
                expect(err).to.be.an(Error);
                expect(err.message).to.match(/was able to satisfy ~0.2.0/i);
                expect(err.details).to.match(/available versions: 0\.1\.1, 0\.1\.0/i);
                expect(err.code).to.equal('ENORESTARGET');
                next();
            })
            .done();
        });

        it('should fail to resolve if there are no versions to match a range/version', function (next) {
            var resolver;

            BzrResolver.tags = function () {
                return Q.resolve({
                    'foo': 1
                });
            };

            resolver = create('foo');

            resolver._findResolution('~0.2.0')
            .then(function () {
                next(new Error('Should have failed'));
            }, function (err) {
                expect(err).to.be.an(Error);
                expect(err.message).to.match(/was able to satisfy ~0.2.0/i);
                expect(err.details).to.match(/no versions found in foo/i);
                expect(err.code).to.equal('ENORESTARGET');
                next();
            })
            .done();
        });

        it('should resolve to the specified revno', function (next) {
            var resolver;

            BzrResolver.tags = function () {
                return Q.resolve({
                    'some-tag': 1
                });
            };

            resolver = create('foo');
            resolver._findResolution('revno:1')
            .then(function (resolution) {
                expect(resolution).to.eql({
                    type: 'revno',
                    commit: 1
                });
                next();
            })
            .done();
        });

        it('should resolve to the specified tag if it exists', function (next) {
            var resolver;

            BzrResolver.tags = function () {
                return Q.resolve({
                    'some-tag': 1
                });
            };

            resolver = create('foo');
            resolver._findResolution('some-tag')
            .then(function (resolution) {
                expect(resolution).to.eql({
                    type: 'tag',
                    tag: 'some-tag',
                    commit: 1
                });
                next();
            })
            .done();
        });

        it('should fail to resolve to the specified tag if it doesn\'t exists', function (next) {
            var resolver;

            BzrResolver.tags = function () {
                return Q.resolve({
                    'some-tag': 2
                });
            };

            resolver = create('foo');
            resolver._findResolution('some-branch')
            .then(function () {
                next(new Error('Should have failed'));
            }, function (err) {
                expect(err).to.be.an(Error);
                expect(err.message).to.match(/target some-branch does not exist/i);
                expect(err.details).to.match(/available tags: some-tag/i);
                expect(err.code).to.equal('ENORESTARGET');
                next();
            })
            .done();
        });
    });

    describe('._cleanup', function () {
        beforeEach(function () {
            mkdirp.sync(tempDir);
        });

        afterEach(function (next) {
            clearResolverRuntimeCache();
            // Need to chmodr before removing..at least on windows
            // because .bzr has some read only files
            chmodr(tempDir, 0777, function () {
                rimraf(tempDir, next);
            });
        });

        it('should remove the .bzr folder from the temp dir', function (next) {
            var resolver = create('foo');
            var dst = path.join(tempDir, '.bzr');

            this.timeout(30000);  // Give some time to copy

            // Copy .bzr folder to the tempDir
            copy.copyDir(path.resolve(__dirname, '../../assets/package-bzr/.bzr'), dst, {
                mode: 0777
            })
            .then(function () {
                resolver._tempDir = tempDir;

                return resolver._cleanup()
                .then(function () {
                    expect(fs.existsSync(dst)).to.be(false);
                    next();
                });
            })
            .done();
        });

        it('should not fail if .bzr does not exist for some reason', function (next) {
            var resolver = create('foo');
            var dst = path.join(tempDir, '.bzr');

            resolver._tempDir = tempDir;

            resolver._cleanup()
            .then(function () {
                expect(fs.existsSync(dst)).to.be(false);
                next();
            })
            .done();
        });

        it('should sill run even if _checkout fails for some reason', function (next) {
            var resolver = create('foo');
            var called = false;

            BzrResolver.tags = function () {
                return Q.resolve({
                    '1.0.0': 1
                });
            };

            resolver._tempDir = tempDir;
            resolver._checkout = function () {
                return Q.reject(new Error('Some error'));
            };

            resolver._cleanup = function () {
                called = true;
                return BzrResolver.prototype._cleanup.apply(this, arguments);
            };

            resolver.resolve()
            .then(function () {
                next(new Error('Should have failed'));
            }, function () {
                expect(called).to.be(true);
                next();
            })
            .done();
        });
    });

    describe('._savePkgMeta', function () {
        before(function () {
            mkdirp.sync(tempDir);
        });

        afterEach(function (next) {
            rimraf(path.join(tempDir, '.bower.json'), next);
        });

        after(function (next) {
            rimraf(tempDir, next);
        });

        it('should save the resolution to the .bower.json to be used later by .hasNew', function (next) {
            var resolver = create('foo');

            resolver._resolution = { type: 'version', tag: '0.0.1' };
            resolver._tempDir = tempDir;

            resolver._savePkgMeta({ name: 'foo', version: '0.0.1' })
            .then(function () {
                return Q.nfcall(fs.readFile, path.join(tempDir, '.bower.json'));
            })
            .then(function (contents) {
                var json = JSON.parse(contents.toString());

                expect(json._resolution).to.eql(resolver._resolution);
                next();
            })
            .done();
        });

        it('should save the release in the package meta', function (next) {
            var resolver = create('foo');
            var metaFile = path.join(tempDir, '.bower.json');

            // Test with type 'version'
            resolver._resolution = { type: 'version', tag: '0.0.1', commit: '1' };
            resolver._tempDir = tempDir;

            resolver._savePkgMeta({ name: 'foo', version: '0.0.1' })
            .then(function () {
                return Q.nfcall(fs.readFile, metaFile);
            })
            .then(function (contents) {
                var json = JSON.parse(contents.toString());
                expect(json._release).to.equal('0.0.1');
            })
            // Test with type 'version' + build metadata
            .then(function () {
                resolver._resolution = { type: 'version', tag: '0.0.1+build.5', commit: '1' };
                return resolver._savePkgMeta({ name: 'foo' });
            })
            .then(function () {
                return Q.nfcall(fs.readFile, metaFile);
            })
            .then(function (contents) {
                var json = JSON.parse(contents.toString());
                expect(json._release).to.equal('0.0.1+build.5');
            })
            // Test with type 'tag'
            .then(function () {
                resolver._resolution = { type: 'tag', tag: '0.0.1', commit: '1' };
                return resolver._savePkgMeta({ name: 'foo' });
            })
            .then(function () {
                return Q.nfcall(fs.readFile, metaFile);
            })
            .then(function (contents) {
                var json = JSON.parse(contents.toString());
                expect(json._release).to.equal('0.0.1');
            })
            // Test with type 'branch'
            // In this case, it should be the commit
            .then(function () {
                resolver._resolution = { type: 'branch', branch: 'foo', commit: '1' };
                return resolver._savePkgMeta({ name: 'foo' });
            })
            .then(function () {
                return Q.nfcall(fs.readFile, metaFile);
            })
            .then(function (contents) {
                var json = JSON.parse(contents.toString());
                expect(json._release).to.equal('1');
            })
            // Test with type 'commit'
            .then(function () {
                resolver._resolution = { type: 'commit', commit: '1' };
                return resolver._savePkgMeta({ name: 'foo' });
            })
            .then(function () {
                return Q.nfcall(fs.readFile, metaFile);
            })
            .then(function (contents) {
                var json = JSON.parse(contents.toString());
                expect(json._release).to.equal('1');
                next();
            })
            .done();
        });

        it('should add the version to the package meta if not present and resolution is a version', function (next) {
            var resolver = create('foo');

            resolver._resolution = { type: 'version', tag: 'v0.0.1' };
            resolver._tempDir = tempDir;

            resolver._savePkgMeta({ name: 'foo' })
            .then(function () {
                return Q.nfcall(fs.readFile, path.join(tempDir, '.bower.json'));
            })
            .then(function (contents) {
                var json = JSON.parse(contents.toString());
                expect(json.version).to.equal('0.0.1');

                next();
            })
            .done();
        });

        it('should remove the version from the package meta if resolution is not a version', function (next) {
            var resolver = create('foo');

            resolver._resolution = { type: 'commit', commit: '1' };
            resolver._tempDir = tempDir;

            resolver._savePkgMeta({ name: 'foo', version: '0.0.1' })
            .then(function () {
                return Q.nfcall(fs.readFile, path.join(tempDir, '.bower.json'));
            })
            .then(function (contents) {
                var json = JSON.parse(contents.toString());
                expect(json).to.not.have.property('version');

                next();
            })
            .done();
        });

        it('should warn if the resolution version is different than the package meta version', function (next) {
            var resolver = create('foo');
            var notified = false;

            resolver._resolution = { type: 'version', tag: '0.0.1' };
            resolver._tempDir = tempDir;

            logger.on('log', function (log) {
                expect(log).to.be.an('object');

                if (log.level === 'warn' && log.id === 'mismatch') {
                    expect(log.message).to.match(/\(0\.0\.0\).*different.*\(0\.0\.1\)/);
                    notified = true;
                }
            });

            resolver._savePkgMeta({ name: 'foo', version: '0.0.0' })
            .then(function () {
                return Q.nfcall(fs.readFile, path.join(tempDir, '.bower.json'));
            })
            .then(function (contents) {
                var json = JSON.parse(contents.toString());
                expect(json.version).to.equal('0.0.1');
                expect(notified).to.be(true);

                next();
            })
            .done();
        });

        it('should not warn if the resolution version and the package meta version are the same', function (next) {
            var resolver = create('foo');
            var notified = false;

            resolver._resolution = { type: 'version', tag: 'v0.0.1' };
            resolver._tempDir = tempDir;

            resolver._savePkgMeta({ name: 'foo', version: '0.0.1' })
            .then(function () {
                return Q.nfcall(fs.readFile, path.join(tempDir, '.bower.json'));
            }, null)
            .then(function (contents) {
                var json = JSON.parse(contents.toString());
                expect(json.version).to.equal('0.0.1');
                expect(notified).to.be(false);

                next();
            })
            .done();
        });
    });

    describe('#clearRuntimeCache', function () {
        // Use a class that inherit the BzrResolver to see if it uses
        // late binding when clearing the cache
        function CustomBzrResolver() {}
        util.inherits(CustomBzrResolver, BzrResolver);
        mout.object.mixIn(CustomBzrResolver, BzrResolver);


        it('should clear tags cache', function () {
            CustomBzrResolver._cache.tags.set('foo', {});
            CustomBzrResolver.clearRuntimeCache();
            expect(CustomBzrResolver._cache.tags.has('foo')).to.be(false);
        });

        it('should clear versions cache', function () {
            CustomBzrResolver._cache.versions.set('foo', {});
            CustomBzrResolver.clearRuntimeCache();
            expect(CustomBzrResolver._cache.versions.has('foo')).to.be(false);
        });
    });

    describe('#versions', function () {
        afterEach(clearResolverRuntimeCache);

        it('should resolve to an empty array if no tags are found', function (next) {
            BzrResolver.tags = function () {
                return Q.resolve({});
            };

            BzrResolver.versions('foo')
            .then(function (versions) {
                expect(versions).to.be.an('array');
                expect(versions).to.eql([]);
                next();
            })
            .done();
        });

        it('should resolve to an empty array if no valid semver tags', function (next) {
            BzrResolver.tags = function () {
                return Q.resolve({
                    'foo': 1,
                    'bar': 2,
                    'baz': 3
                });
            };

            BzrResolver.versions('foo')
            .then(function (versions) {
                expect(versions).to.be.an('array');
                expect(versions).to.eql([]);
                next();
            })
            .done();
        });

        it('should resolve to an array of versions, ignoring invalid semver tags', function (next) {
            BzrResolver.tags = function () {
                return Q.resolve({
                    '0.2.1':     1,
                    'v0.1.1':    2,
                    '0.1.0':     3,
                    'invalid':   4, // invalid
                    '/':         5, // invalid
                    '':          6  // invalid
                });
            };

            BzrResolver.versions('foo', true)
            .then(function (versions) {
                expect(versions).to.eql([
                    { version: '0.2.1', tag: '0.2.1', commit: 1 },
                    { version: '0.1.1', tag: 'v0.1.1', commit: 2 },
                    { version: '0.1.0', tag: '0.1.0', commit: 3 }
                ]);
            })
            .then(function () {
                return BzrResolver.versions('foo');
            })
            .then(function (versions) {
                expect(versions).to.eql(['0.2.1', '0.1.1', '0.1.0']);
                next();
            })
            .done();
        });

        it('should order the versions according to the semver spec', function (next) {
            BzrResolver.tags = function () {
                return Q.resolve({
                    '0.1.0':           1,
                    '0.1.1+build.11':  2,
                    '0.1.1+build.100': 3,
                    '0.1.1-rc.22':     4,
                    '0.1.1-rc.200':    5,
                    '0.1.1':           6,
                    'v0.2.1':          7
                });
            };

            BzrResolver.versions('foo', true)
            .then(function (versions) {
                expect(versions).to.eql([
                    { version: '0.2.1', tag: 'v0.2.1', commit: '7' },
                    { version: '0.1.1+build.11', tag: '0.1.1+build.11', commit: '2' },
                    { version: '0.1.1+build.100', tag: '0.1.1+build.100', commit: '3' },
                    { version: '0.1.1', tag: '0.1.1', commit: '6' },
                    { version: '0.1.1-rc.200', tag: '0.1.1-rc.200', commit: '5' },
                    { version: '0.1.1-rc.22', tag: '0.1.1-rc.22', commit: '4' },
                    { version: '0.1.0', tag: '0.1.0', commit: '1' }
                ]);
                next();
            })
            .done();
        });

        it('should cache the result for each source', function (next) {
            BzrResolver.tags = function (source) {
                if (source === 'foo') {
                    return Q.resolve({
                        '0.2.1': 123,
                        '0.1.0': 456
                    });
                }

                return Q.resolve({
                    '0.3.1': 7,
                    '0.3.0': 8
                });

            };

            BzrResolver.versions('foo')
            .then(function (versions) {
                expect(versions).to.eql(['0.2.1', '0.1.0']);

                return BzrResolver.versions('bar');
            })
            .then(function (versions) {
                expect(versions).to.eql(['0.3.1', '0.3.0']);


                // Manipulate the cache and check if it resolves for the cached ones
                BzrResolver._cache.versions.get('foo').splice(1, 1);
                BzrResolver._cache.versions.get('bar').splice(1, 1);

                return BzrResolver.versions('foo');
            })
            .then(function (versions) {
                expect(versions).to.eql(['0.2.1']);

                return BzrResolver.versions('bar');
            })
            .then(function (versions) {
                expect(versions).to.eql(['0.3.1']);
                next();
            })
            .done();
        });

        it('should work if requested in parallel for the same source', function (next) {
            BzrResolver.tags = function () {
                return Q.resolve({
                    '0.2.1': 123,
                    '0.1.0': 456
                });
            };

            Q.all([
                BzrResolver.versions('foo'),
                BzrResolver.versions('foo')
            ])
            .spread(function (versions1, versions2) {
                expect(versions1).to.eql(['0.2.1', '0.1.0']);
                expect(versions2).to.eql(versions1);

                next();
            })
            .done();
        });
    });

    // remote resolver tests
    describe('.constructor', function () {
        it('should guess the name from the path', function () {
            var resolver;

            resolver = create('file://' + testPackage);
            expect(resolver.getName()).to.equal('package-bzr');

            resolver = create('lp:~stephen-stewart/+junk/bower-test-package');
            expect(resolver.getName()).to.equal('bower-test-package');

        });
    });
    describe('.resolve', function () {

        it('should checkout correctly if resolution is a tag', function (next) {
            var resolver = create({ source: 'file://' + testPackage, target: '~0.0.1' });

            resolver.resolve()
            .then(function (dir) {
                expect(dir).to.be.a('string');

                var files = fs.readdirSync(dir);

                expect(files).to.contain('foo');
                expect(files).to.contain('bar');
                expect(files).to.not.contain('baz');

                next();
            })
            .done();
        });

        it('should checkout correctly if resolution is a commit', function (next) {
            var resolver = create({ source: 'file://' + testPackage, target: 'revno:1' });

            resolver.resolve()
            .then(function (dir) {
                expect(dir).to.be.a('string');

                var files = fs.readdirSync(dir);

                expect(files).to.not.contain('foo');
                expect(files).to.not.contain('bar');
                expect(files).to.not.contain('baz');
                expect(files).to.contain('.master');
                next();
            })
            .done();
        });

    });
});
