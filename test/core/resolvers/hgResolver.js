var expect = require('expect.js');
var util = require('util');
var path = require('path');
var fs = require('graceful-fs');
var rimraf = require('rimraf');
var mkdirp = require('mkdirp');
var Q = require('q');
var mout = require('mout');
var Logger = require('bower-logger');
var HgResolver = require('../../../lib/core/resolvers/HgResolver');
var defaultConfig = require('../../../lib/config');

describe('HgResolver', function () {
    var tempDir = path.resolve(__dirname, '../../tmp/tmp');
    var testPackage = path.resolve(__dirname, '../../assets/package-hg');
    var originaltags = HgResolver.tags;
    var originalbranches = HgResolver.branches;
    var logger;

    before(function () {
        logger = new Logger();
    });

    afterEach(function () {
        logger.removeAllListeners();
    });


	function clearResolverRuntimeCache() {
        HgResolver.tags = originaltags;
        HgResolver.branches = originalbranches;
        HgResolver.clearRuntimeCache();
    }

    function create(decEndpoint) {
        if (typeof decEndpoint === 'string') {
            decEndpoint = { source: decEndpoint };
        }
        var resolver = new HgResolver(decEndpoint, defaultConfig(), logger);
		resolver._tempDir = tempDir;
		return resolver;
    }

	describe('misc', function () {
        it.skip('should error out if hg is not installed');
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

            HgResolver.tags = function () {
                return Q.resolve({
                    'boo': 123  // same commit hash on purpose
                });
            };

            HgResolver.branches = function () {
                return Q.resolve({
                    'default': '*'
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

            HgResolver.tags = function () {
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

            HgResolver.tags = function () {
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

            HgResolver.tags = function () {
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

            HgResolver.tags = function () {
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
                    type: 'commit',
                    commit: 1
                }
            }));

            HgResolver.tags = function () {
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
                HgResolver.apply(this, arguments);
                this._stack = [];
            }

            util.inherits(DummyResolver, HgResolver);
            mout.object.mixIn(DummyResolver, HgResolver);

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
                return HgResolver.prototype.resolve.apply(this, arguments);
            };

            DummyResolver.prototype._findResolution = function () {
                this._stack.push('before _findResolution');
                return HgResolver.prototype._findResolution.apply(this, arguments)
                .then(function (val) {
                    this._stack.push('after _findResolution');
                    return val;
                }.bind(this));
            };

            DummyResolver.prototype._clone = function () {
                this._stack.push('before _clone');
                return Q.resolve()
                .then(function (val) {
                    this._stack.push('after _clone');
                    return val;
                }.bind(this));
            };

            resolver = new DummyResolver({ source: 'foo', target: '1.0.0' }, defaultConfig(), logger);

            resolver.resolve()
            .then(function () {
                expect(resolver.getStack()).to.eql([
                    'before _findResolution',
                    'after _findResolution',
                    'before _clone',
                    'after _clone'
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

            HgResolver.tags = function () {
                return Q.resolve({});
            };

			HgResolver.branches = function () {
                return Q.resolve({
                    'default': '1'
                });
            };

            resolver = create('foo');
            resolver._findResolution('*')
            .then(function (resolution) {
				expect(resolution).to.be.an('object');
                next();
            })
            .done();
        });

		it('should resolve "*" to default if a repository has no valid semver tags', function (next) {
            var resolver;

            HgResolver.tags = function () {
                return Q.resolve({
                    'some-tag': 1
                });
            };

			HgResolver.branches = function () {
                return Q.resolve({
                    'default': '1'
                });
            };

            resolver = create('foo');
            resolver._findResolution('*')
            .then(function (resolution) {
                expect(resolution).to.eql({
                    type: 'branch',
                    branch: 'default',
                    commit: '1'
                });
                next();
            })
            .done();
        });

		it('should resolve "*" to the latest version if a repository has valid semver tags, ignoring pre-releases', function (next) {
            var resolver;

            HgResolver.tags = function () {
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

            HgResolver.tags = function () {
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

            HgResolver.tags = function () {
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

            HgResolver.tags = function () {
                return Q.resolve({
                    '1.0': 1
                });
            };

			HgResolver.branches = function () {
                return Q.resolve({});
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

            HgResolver.tags = function () {
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

            HgResolver.tags = function () {
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

            HgResolver.tags = function () {
                return Q.resolve({
                    '0.1.0': 1,
                    'v0.1.1': 2
                });
            };

			HgResolver.branches = function () {
                return Q.resolve({});
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

            HgResolver.tags = function () {
                return Q.resolve({
                    'foo': 1
                });
            };

			HgResolver.branches = function () {
                return Q.resolve({});
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

		it('should resolve to the specified commit', function (next) {
            var resolver;

            HgResolver.tags = function () {
                return Q.resolve({
                    'some-tag': 1
                });
            };

            resolver = create('foo');
            resolver._findResolution('1')
            .then(function (resolution) {
                expect(resolution).to.eql({
                    type: 'commit',
                    commit: 1
                });
                next();
            })
            .done();
        });

		it('should resolve to the specified tag if it exists', function (next) {
            var resolver;

            HgResolver.tags = function () {
                return Q.resolve({
                    'some-tag': 1
                });
            };

			HgResolver.branches = function () {
                return Q.resolve({});
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

		it('should resolve to the specified branches if it exists', function (next) {
            var resolver;

			HgResolver.tags = function () {
                return Q.resolve({
                    'some-tag': 1
                });
            };

            HgResolver.branches = function () {
                return Q.resolve({
                    'some-branch': 1
                });
            };

            resolver = create('foo');
            resolver._findResolution('some-branch')
            .then(function (resolution) {
                expect(resolution).to.eql({
                    type: 'branch',
                    branch: 'some-branch',
                    commit: 1
                });
                next();
            })
            .done();
        });

		it('should fail to resolve to the specified tag/branch if it doesn\'t exist', function (next) {
            var resolver;

            HgResolver.tags = function () {
                return Q.resolve({
                    'some-tag': 2
                });
            };

			HgResolver.branches = function () {
                return Q.resolve({
                    'default': 2
                });
            };

            resolver = create('foo');
            resolver._findResolution('some-branch')
            .then(function () {
                next(new Error('Should have failed'));
            }, function (err) {
                expect(err).to.be.an(Error);
                expect(err.message).to.match(/tag\/branch some-branch does not exist/i);
                expect(err.details).to.match(/available branches: default/i);
                expect(err.details).to.match(/available tags: some-tag/i);
                expect(err.code).to.equal('ENORESTARGET');
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
			var metaFile;

            // Test with type 'version'
            resolver._resolution = { type: 'version', tag: '0.0.1', commit: '1' };
			resolver._clonePath.then(function (clonePath) {
				metaFile = path.join(clonePath, '.bower.json');
			})
			.then(resolver._savePkgMeta.bind(resolver, { name: 'foo', version: '0.0.1' }))
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

        it('should add the version to the package meta if not present and resolution is a version', function (next) {
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

        it('should remove the version from the package meta if resolution is not a version', function (next) {
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
        // Use a class that inherit the HgResolver to see if it uses
        // late binding when clearing the cache
        function CustomHgResolver() {}
        util.inherits(CustomHgResolver, HgResolver);
        mout.object.mixIn(CustomHgResolver, HgResolver);

        it('should clear tags cache', function () {
            CustomHgResolver._cache.tags.set('foo', {});
            CustomHgResolver.clearRuntimeCache();
            expect(CustomHgResolver._cache.tags.has('foo')).to.be(false);
        });

        it('should clear versions cache', function () {
            CustomHgResolver._cache.versions.set('foo', {});
            CustomHgResolver.clearRuntimeCache();
            expect(CustomHgResolver._cache.versions.has('foo')).to.be(false);
        });
    });

	describe('#versions', function () {
        afterEach(clearResolverRuntimeCache);

        it('should resolve to an empty array if no tags are found', function (next) {
            HgResolver.tags = function () {
                return Q.resolve({});
            };

            HgResolver.versions('foo')
            .then(function (versions) {
                expect(versions).to.be.an('array');
                expect(versions).to.eql([]);
                next();
            })
            .done();
        });

        it('should resolve to an empty array if no valid semver tags', function (next) {
            HgResolver.tags = function () {
                return Q.resolve({
                    'foo': 1,
                    'bar': 2,
                    'baz': 3
                });
            };

            HgResolver.versions('foo')
            .then(function (versions) {
                expect(versions).to.be.an('array');
                expect(versions).to.eql([]);
                next();
            })
            .done();
        });

        it('should resolve to an array of versions, ignoring invalid semver tags', function (next) {
            HgResolver.tags = function () {
                return Q.resolve({
                    '0.2.1':     1,
                    'v0.1.1':    2,
                    '0.1.0':     3,
                    'invalid':   4, // invalid
                    '/':         5, // invalid
                    '':          6  // invalid
                });
            };

            HgResolver.versions('foo', true)
            .then(function (versions) {
                expect(versions).to.eql([
                    { version: '0.2.1', tag: '0.2.1', commit: 1 },
                    { version: '0.1.1', tag: 'v0.1.1', commit: 2 },
                    { version: '0.1.0', tag: '0.1.0', commit: 3 }
                ]);
            })
            .then(function () {
                return HgResolver.versions('foo');
            })
            .then(function (versions) {
                expect(versions).to.eql(['0.2.1', '0.1.1', '0.1.0']);
                next();
            })
            .done();
        });

        it('should order the versions according to the semver spec', function (next) {
            HgResolver.tags = function () {
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

            HgResolver.versions('foo', true)
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
            HgResolver.tags = function (source) {
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

            HgResolver.versions('foo')
            .then(function (versions) {
                expect(versions).to.eql(['0.2.1', '0.1.0']);

                return HgResolver.versions('bar');
            })
            .then(function (versions) {
                expect(versions).to.eql(['0.3.1', '0.3.0']);


                // Manipulate the cache and check if it resolves for the cached ones
                HgResolver._cache.versions.get('foo').splice(1, 1);
                HgResolver._cache.versions.get('bar').splice(1, 1);

                return HgResolver.versions('foo');
            })
            .then(function (versions) {
                expect(versions).to.eql(['0.2.1']);

                return HgResolver.versions('bar');
            })
            .then(function (versions) {
                expect(versions).to.eql(['0.3.1']);
                next();
            })
            .done();
        });

        it('should work if requested in parallel for the same source', function (next) {
            HgResolver.tags = function () {
                return Q.resolve({
                    '0.2.1': 123,
                    '0.1.0': 456
                });
            };

            Q.all([
                HgResolver.versions('foo'),
                HgResolver.versions('foo')
            ])
            .spread(function (versions1, versions2) {
                expect(versions1).to.eql(['0.2.1', '0.1.0']);
                expect(versions2).to.eql(versions1);

                next();
            })
            .done();
        });
    });

	describe('#parseMercurialListOutput', function () {
        var list = [
			'branch-4                       5:ce686073241f',
			'branchNo.3                     4:c4473daeb66f (inactive)',
			'branch#2TEST                   3:4a953a54dc8d (inactive)',
			'branch1.0.0                    2:6e37fd1b6d6f (inactive)',
			'default                        1:38564357c0db (inactive)'
        ].join('\r\n');

        it('should not include the . (dot)path', function () {
            var actual = HgResolver.parseMercurialListOutput(list);

            expect(actual).to.not.have.keys('.');
        });

        it('should parse path names with alphanumerics, dashes, dots and underscores', function () {
            var actual = HgResolver.parseMercurialListOutput(list);

            expect(actual).to.eql({
				'branch-4'      : '5',
                'branchNo.3'    : '4',
                'branch#2TEST'   : '3',
                'branch1.0.0'   : '2',
                'default'    : '1'
            });
        });
    });

	// remote resolver tests
    describe('.constructor', function () {
        it('should guess the name from the path', function () {
            var resolver;

            resolver = create('hg+http://yii.googlecode.com/hg');
            expect(resolver.getName()).to.equal('hg');
        });
    });

	describe('.resolve', function () {

        it('should export correctly if resolution is a tag', function (next) {
            var resolver = create({ source: testPackage, target: 'tag-0.0.1' });

            resolver.resolve()
            .then(function (dir) {
                expect(dir).to.be.a('string');

                var files = fs.readdirSync(dir);

                expect(files).to.contain('foo');
                expect(files).to.not.contain('bar');
                next();
            })
            .done();
        });

        it('should export correctly if resolution is a commit', function (next) {
            var resolver = create({ source: testPackage, target: '0' });

            resolver.resolve()
            .then(function (dir) {
                expect(dir).to.be.a('string');

                var files = fs.readdirSync(dir);

                expect(files).to.not.contain('foo');
                expect(files).to.not.contain('bar');
                expect(files).to.not.contain('baz');
                next();
            })
            .done();
        });

		it('should export correctly if resolution is a branch', function (next) {
            var resolver = create({ source: testPackage, target: 'branch-0.0.1' });

            resolver.resolve()
            .then(function (dir) {
                expect(dir).to.be.a('string');

                var files = fs.readdirSync(dir);

                expect(files).to.contain('foo');
                expect(files).to.not.contain('bar');
                next();
            })
            .done();
        });
    });
});
