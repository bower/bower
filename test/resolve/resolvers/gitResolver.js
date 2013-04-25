var expect = require('expect.js');
var util = require('util');
var path = require('path');
var fs = require('fs');
var mkdirp = require('mkdirp');
var chmodr = require('chmodr');
var rimraf = require('rimraf');
var ncp = require('ncp');
var Q = require('q');
var mout = require('mout');
var GitResolver = require('../../../lib/resolve/resolvers/GitResolver');

describe('GitResolver', function () {
    var tempDir = path.resolve(__dirname, '../../assets/tmp'),
        originalFetchRefs = GitResolver.fetchRefs;

    function cleanInternalResolverCache() {
        GitResolver.fetchRefs = originalFetchRefs;
        delete GitResolver._versions;
        delete GitResolver._heads;
        delete GitResolver._refs;
    }

    describe('.hasNew', function () {
        beforeEach(function (next) {
            mkdirp(tempDir, next);
        });

        afterEach(function (next) {
            cleanInternalResolverCache();
            rimraf(tempDir, next);
        });

        it('should be true when the resolution type is different', function (next) {
            var resolver;

            fs.writeFileSync(path.join(tempDir, 'bower.json'), JSON.stringify({
                name: 'foo',
                version: '0.0.0',
                _resolution: {
                    type: 'tag',
                    tag: '0.0.0',
                    commit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
                }
            }));
            GitResolver.fetchRefs = function () {
                return Q.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master'
                ]);
            };

            resolver = new GitResolver('foo');
            resolver.hasNew(tempDir)
            .then(function (hasNew) {
                expect(hasNew).to.be(true);
                next();
            })
            .done();
        });

        it('should be true when a higher version for a range is available', function (next) {
            var resolver;

            fs.writeFileSync(path.join(tempDir, 'bower.json'), JSON.stringify({
                name: 'foo',
                version: '1.0.0',
                _resolution: {
                    type: 'tag',
                    tag: '1.0.0',
                    commit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
                }
            }));
            GitResolver.fetchRefs = function () {
                return Q.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags/1.0.0',
                    'cccccccccccccccccccccccccccccccccccccccc refs/tags/1.0.1'
                ]);
            };

            resolver = new GitResolver('foo');
            resolver.hasNew(tempDir)
            .then(function (hasNew) {
                expect(hasNew).to.be(true);
                next();
            })
            .done();
        });

        it('should be true when a resolved to a lower version of a range', function (next) {
            var resolver;

            fs.writeFileSync(path.join(tempDir, 'bower.json'), JSON.stringify({
                name: 'foo',
                version: '1.0.1',
                _resolution: {
                    type: 'tag',
                    tag: '1.0.1',
                    commit: 'cccccccccccccccccccccccccccccccccccccccc'
                }
            }));
            GitResolver.fetchRefs = function () {
                return Q.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags/1.0.0'
                ]);
            };

            resolver = new GitResolver('foo');
            resolver.hasNew(tempDir)
            .then(function (hasNew) {
                expect(hasNew).to.be(true);
                next();
            })
            .done();
        });

        it('should be false when resolved to the same tag (with same commit hash) for a given range', function (next) {
            var resolver;

            fs.writeFileSync(path.join(tempDir, 'bower.json'), JSON.stringify({
                name: 'foo',
                version: '1.0.1',
                _resolution: {
                    type: 'tag',
                    tag: '1.0.1',
                    commit: 'cccccccccccccccccccccccccccccccccccccccc'
                }
            }));
            GitResolver.fetchRefs = function () {
                return Q.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags/1.0.0',
                    'cccccccccccccccccccccccccccccccccccccccc refs/tags/1.0.1'
                ]);
            };

            resolver = new GitResolver('foo');
            resolver.hasNew(tempDir)
            .then(function (hasNew) {
                expect(hasNew).to.be(false);
                next();
            })
            .done();
        });

        it('should be true when resolved to the same tag (with different commit hash) for a given range', function (next) {
            var resolver;

            fs.writeFileSync(path.join(tempDir, 'bower.json'), JSON.stringify({
                name: 'foo',
                version: '1.0.1',
                _resolution: {
                    type: 'tag',
                    tag: '1.0.1',
                    commit: 'cccccccccccccccccccccccccccccccccccccccc'
                }
            }));
            GitResolver.fetchRefs = function () {
                return Q.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags/1.0.0',
                    'dddddddddddddddddddddddddddddddddddddddd refs/tags/1.0.1'
                ]);
            };

            resolver = new GitResolver('foo');
            resolver.hasNew(tempDir)
            .then(function (hasNew) {
                expect(hasNew).to.be(true);
                next();
            })
            .done();
        });

        it('should be true when a different commit hash for a given branch is available', function (next) {
            var resolver;

            fs.writeFileSync(path.join(tempDir, 'bower.json'), JSON.stringify({
                name: 'foo',
                _resolution: {
                    type: 'branch',
                    branch: 'master',
                    commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
                }
            }));
            GitResolver.fetchRefs = function () {
                return Q.resolve([
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/heads/master'
                ]);
            };

            resolver = new GitResolver('foo');
            resolver.hasNew(tempDir)
            .then(function (hasNew) {
                expect(hasNew).to.be(true);
                next();
            })
            .done();
        });

        it('should be false when resolved to the the same commit hash for a given branch', function (next) {
            var resolver;

            fs.writeFileSync(path.join(tempDir, 'bower.json'), JSON.stringify({
                name: 'foo',
                _resolution: {
                    type: 'branch',
                    branch: 'master',
                    commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
                }
            }));
            GitResolver.fetchRefs = function () {
                return Q.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master'
                ]);
            };

            resolver = new GitResolver('foo');
            resolver.hasNew(tempDir)
            .then(function (hasNew) {
                expect(hasNew).to.be(false);
                next();
            })
            .done();
        });

        it('should be false when targeting commit hashes', function (next) {
            var resolver;

            fs.writeFileSync(path.join(tempDir, 'bower.json'), JSON.stringify({
                name: 'foo',
                _resolution: {
                    type: 'commit',
                    commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
                }
            }));
            GitResolver.fetchRefs = function () {
                return Q.resolve([
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/heads/master'
                ]);
            };

            resolver = new GitResolver('foo');
            resolver.hasNew(tempDir)
            .then(function (hasNew) {
                expect(hasNew).to.be(true);
                next();
            })
            .done();
        });
    });

    describe('._resolveSelf', function () {
        afterEach(cleanInternalResolverCache);

        it('should call the necessary functions by the correct order', function (next) {
            function DummyResolver() {
                GitResolver.apply(this, arguments);
                this._stack = [];
            }

            util.inherits(DummyResolver, GitResolver);
            mout.object.mixIn(DummyResolver, GitResolver);

            DummyResolver.prototype.getStack = function () {
                return this._stack;
            };

            DummyResolver.fetchRefs = function () {
                return Q.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master'
                ]);
            };

            DummyResolver.prototype.resolve = function () {
                this._stack = [];
                return GitResolver.prototype.resolve.apply(this, arguments);
            };

            DummyResolver.prototype._findResolution = function () {
                this._stack.push('before _findResolution');
                return GitResolver.prototype._findResolution.apply(this, arguments)
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
                return GitResolver.prototype._cleanup.apply(this, arguments)
                .then(function (val) {
                    this._stack.push('after _cleanup');
                    return val;
                }.bind(this));
            };

            var resolver = new DummyResolver('foo', { target: 'master' });

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

        it('should reject the promise if _checkout is not implemented', function (next) {
            var resolver = new GitResolver('foo');

            GitResolver.fetchRefs = function () {
                return Q.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master'
                ]);
            };

            resolver.resolve()
            .then(function () {
                next(new Error('Should have rejected the promise'));
            }, function (err) {
                expect(err).to.be.an(Error);
                expect(err.message).to.contain('_checkout not implemented');
                next();
            })
            .done();
        });

        it('should reject the promise if #fetchRefs is not implemented', function (next) {
            var resolver = new GitResolver('foo');

            resolver._checkout = function () {
                return Q.resolve();
            };

            resolver.resolve()
            .then(function () {
                next(new Error('Should have rejected the promise'));
            }, function (err) {
                expect(err).to.be.an(Error);
                expect(err.message).to.contain('fetchRefs not implemented');
                next();
            })
            .done();
        });
    });

    describe('._findResolution', function () {
        afterEach(cleanInternalResolverCache);

        it('should resolve to an object', function (next) {
            var resolver;

            GitResolver.fetchRefs = function () {
                return Q.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master'
                ]);
            };

            resolver = new GitResolver('foo');
            resolver._findResolution('*')
            .then(function (resolution) {
                expect(resolution).to.be.an('object');
                next();
            })
            .done();
        });

        it('should fail to resolve * if no tags/heads are found', function (next) {
            var resolver;

            GitResolver.fetchRefs = function () {
                return Q.resolve([]);
            };

            resolver = new GitResolver('foo');
            resolver._findResolution('*')
            .then(function () {
                next(new Error('Should have failed'));
            }, function (err) {
                expect(err).to.be.an(Error);
                expect(err.message).to.match(/branch "master" does not exist/i);
                expect(err.details).to.match(/no branches found/i);
                expect(err.code).to.equal('ENORESTARGET');
                next();
            })
            .done();
        });

        it('should resolve "*" to the latest commit on master if a repository has no tags', function (next) {
            var resolver;

            GitResolver.fetchRefs = function () {
                return Q.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/heads/some-branch'
                ]);
            };

            resolver = new GitResolver('foo');
            resolver._findResolution('*')
            .then(function (resolution) {
                expect(resolution).to.eql({
                    type: 'branch',
                    branch: 'master',
                    commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
                });
                next();
            })
            .done();
        });

        it('should resolve "*" to the latest version if a repository has valid semver tags', function (next) {
            var resolver;

            GitResolver.fetchRefs = function () {
                return Q.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags/0.1.0',
                    'cccccccccccccccccccccccccccccccccccccccc refs/tags/v0.1.1'
                ]);
            };

            resolver = new GitResolver('foo');
            resolver._findResolution('*')
            .then(function (resolution) {
                expect(resolver._resolution).to.equal(resolution);
                expect(resolution).to.eql({
                    type: 'tag',
                    tag: 'v0.1.1',
                    commit: 'cccccccccccccccccccccccccccccccccccccccc'
                });
                next();
            })
            .done();
        });

        it('should resolve to the latest version that matches a range/version', function (next) {
            var resolver;

            GitResolver.fetchRefs = function () {
                return Q.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags/0.1.0',
                    'cccccccccccccccccccccccccccccccccccccccc refs/tags/v0.1.1',
                    'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee refs/tags/0.2.0',
                    'ffffffffffffffffffffffffffffffffffffffff refs/tags/v0.2.1'
                ]);
            };

            resolver = new GitResolver('foo');
            resolver._findResolution('~0.2.0')
            .then(function (resolution) {
                expect(resolver._resolution).to.equal(resolution);
                expect(resolution).to.eql({
                    type: 'tag',
                    tag: 'v0.2.1',
                    commit: 'ffffffffffffffffffffffffffffffffffffffff'
                });
                next();
            })
            .done();
        });

        it('should fail to resolve if none of the tags matched a range/version', function (next) {
            var resolver;

            GitResolver.fetchRefs = function () {
                return Q.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags/0.1.0',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags/v0.1.1'
                ]);
            };

            resolver = new GitResolver('foo');
            resolver._findResolution('~0.2.0')
            .then(function () {
                next(new Error('Should have failed'));
            }, function (err) {
                expect(err).to.be.an(Error);
                expect(err.message).to.match(/was able to satisfy "~0.2.0"/i);
                expect(err.details).to.match(/available versions in "foo" are: 0\.1\.1, 0\.1\.0/i);
                expect(err.code).to.equal('ENORESTARGET');
                next();
            })
            .done();
        });

        it('should fail to resolve if there are no tags to match a range/version', function (next) {
            var resolver;

            GitResolver.fetchRefs = function () {
                return Q.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master'
                ]);
            };

            resolver = new GitResolver('foo');

            resolver._findResolution('~0.2.0')
            .then(function () {
                next(new Error('Should have failed'));
            }, function (err) {
                expect(err).to.be.an(Error);
                expect(err.message).to.match(/was able to satisfy "~0.2.0"/i);
                expect(err.details).to.match(/no versions found in "foo"/i);
                expect(err.code).to.equal('ENORESTARGET');
                next();
            })
            .done();
        });

        it('should resolve to the specified commit', function (next) {
            var resolver;

            GitResolver.fetchRefs = function () {
                return Q.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master'
                ]);
            };

            resolver = new GitResolver('foo');
            resolver._findResolution('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
            .then(function (resolution) {
                expect(resolver._resolution).to.equal(resolution);
                expect(resolution).to.eql({
                    type: 'commit',
                    commit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
                });
                next();
            })
            .done();
        });

        it('should resolve to the specified branch if it exists', function (next) {
            var resolver;

            GitResolver.fetchRefs = function () {
                return Q.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/heads/some-branch'
                ]);
            };

            resolver = new GitResolver('foo');
            resolver._findResolution('some-branch')
            .then(function (resolution) {
                expect(resolver._resolution).to.equal(resolution);
                expect(resolution).to.eql({
                    type: 'branch',
                    branch: 'some-branch',
                    commit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
                });
                next();
            })
            .done();
        });

        it('should fail to resolve to the specified branch if it doesn\'t exists', function (next) {
            var resolver;

            GitResolver.fetchRefs = function () {
                return Q.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master'
                ]);
            };

            resolver = new GitResolver('foo');
            resolver._findResolution('some-branch')
            .then(function () {
                next(new Error('Should have failed'));
            }, function (err) {
                expect(err).to.be.an(Error);
                expect(err.message).to.match(/branch "some-branch" does not exist/i);
                expect(err.details).to.match(/available branches in "foo" are: master/i);
                expect(err.code).to.equal('ENORESTARGET');
                next();
            })
            .done();
        });
    });

    describe('._cleanup', function () {
        beforeEach(function (next) {
            mkdirp(tempDir, next);
        });

        afterEach(function (next) {
            cleanInternalResolverCache();
            // Need to chmodr before removing..at least on windows
            // because .git has some read only files
            chmodr(tempDir, 0777, function () {
                rimraf(tempDir, next);
            });
        });

        it('should remove the .git folder from the temp dir', function (next) {
            var resolver = new GitResolver('foo'),
                dest = path.join(tempDir, '.git');

            // Copy .git folder to the tempDir
            ncp(path.resolve(__dirname, '../../../.git'), dest, function (err) {
                if (err) return next(err);

                resolver._tempDir = tempDir;

                resolver._cleanup()
                .then(function () {
                    expect(fs.existsSync(dest)).to.be(false);
                    next();
                })
                .done();
            });
        });

        it('should not fail if .git does not exist for some reason', function (next) {
            var resolver = new GitResolver('foo'),
                dest = path.join(tempDir, '.git');

            resolver._tempDir = tempDir;

            resolver._cleanup()
            .then(function () {
                expect(fs.existsSync(dest)).to.be(false);
                next();
            })
            .done();
        });

        it('should sill run even if _checkout fails for some reason', function (next) {
            var resolver = new GitResolver('foo'),
                called = false;

            GitResolver.fetchRefs = function () {
                return Q.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master'
                ]);
            };

            resolver._tempDir = tempDir;
            resolver._checkout = function () {
                return Q.reject(new Error('Some error'));
            };

            resolver._cleanup = function () {
                called = true;
                return GitResolver.prototype._cleanup.apply(this, arguments);
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
        beforeEach(function (next) {
            mkdirp(tempDir, next);
        });

        afterEach(function (next) {
            rimraf(tempDir, next);
        });

        it('should save the resolution to the .bower.json to be used later by .hasNew', function (next) {
            var resolver = new GitResolver('foo');

            resolver._resolution = { type: 'tag', version: '0.0.1', tag: '0.0.1' };
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

        it('should add the version to the package meta if not present', function (next) {
            var resolver = new GitResolver('foo');

            resolver._resolution = { type: 'tag', version: '0.0.1', tag: '0.0.1' };
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

        it.skip('should warn if the resolution version is different than the package meta version');
    });

    describe('#fetchHeads', function () {
        afterEach(cleanInternalResolverCache);

        it('should resolve to an empty object if no heads are found', function (next) {
            GitResolver.fetchRefs = function () {
                return Q.resolve([]);
            };

            GitResolver.fetchHeads('foo')
            .then(function (heads) {
                expect(heads).to.be.an('object');
                expect(heads).to.eql({});
                next();
            })
            .done();
        });

        it('should resolve to an object where keys are branches and values their commit hashes', function (next) {
            GitResolver.fetchRefs = function () {
                return Q.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/heads/some-branch',
                    'foo refs/heads/invalid',                                           // invalid
                    'cccccccccccccccccccccccccccccccccccccccc refs/heads/',             // invalid
                    'dddddddddddddddddddddddddddddddddddddddd refs/heads',              // invalid
                    'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee refs/tags/some-tag',
                    'ffffffffffffffffffffffffffffffffffffffff refs/tags/0.1.1'
                ]);
            };

            GitResolver.fetchHeads('foo')
            .then(function (heads) {
                expect(heads).to.eql({
                    'master': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                    'some-branch': 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
                });
                next();
            })
            .done();
        });

        it('should cache the result for each source', function (next) {
            GitResolver.fetchRefs = function (source) {
                if (source === 'foo') {
                    return Q.resolve([
                        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master',
                        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/heads/some-branch'
                    ]);
                }

                return Q.resolve([
                    'cccccccccccccccccccccccccccccccccccccccc refs/heads/master',
                    'dddddddddddddddddddddddddddddddddddddddd refs/heads/other-branch'
                ]);
            };

            GitResolver.fetchHeads('foo')
            .then(function (heads) {
                expect(heads).to.eql({
                    'master': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                    'some-branch': 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
                });

                return GitResolver.fetchHeads('bar');
            })
            .then(function (heads) {
                expect(heads).to.eql({
                    'master': 'cccccccccccccccccccccccccccccccccccccccc',
                    'other-branch': 'dddddddddddddddddddddddddddddddddddddddd'
                });

                // Test for the cache
                expect(GitResolver._heads).to.be.an('object');
                expect(GitResolver._heads.foo).to.be.an('object');
                expect(GitResolver._heads.bar).to.be.an('object');

                // Manipulate the cache and check if it resolves for the cached ones
                delete GitResolver._heads.foo.master;
                delete GitResolver._heads.bar.master;

                return GitResolver.fetchHeads('foo');
            })
            .then(function (heads) {
                expect(heads).to.eql({
                    'some-branch': 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
                });

                return GitResolver.fetchHeads('bar');
            })
            .then(function (heads) {
                expect(heads).to.eql({
                    'other-branch': 'dddddddddddddddddddddddddddddddddddddddd'
                });

                next();
            })
            .done();
        });
    });

    describe('#fetchVersions', function () {
        afterEach(cleanInternalResolverCache);

        it('should resolve to an empty array if no tags are found', function (next) {
            GitResolver.fetchRefs = function () {
                return Q.resolve([]);
            };

            GitResolver.fetchVersions('foo')
            .then(function (versions) {
                expect(versions).to.be.an('array');
                expect(versions).to.eql([]);
                next();
            })
            .done();
        });

        it('should resolve to an array of versions, ignoring invalid semver tags', function (next) {
            GitResolver.fetchRefs = function () {
                return Q.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/heads/some-branch',
                    'cccccccccccccccccccccccccccccccccccccccc refs/tags/0.2.1',
                    'dddddddddddddddddddddddddddddddddddddddd refs/tags/0.1.0',
                    'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee refs/tags/v0.1.1',
                    'foo refs/tags/invalid',                                           // invalid
                    'ffffffffffffffffffffffffffffffffffffffff refs/tags/',             // invalid
                    'abbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags'               // invalid
                ]);
            };

            GitResolver.fetchVersions('foo')
            .then(function (versions) {
                expect(versions).to.eql([
                    { version: '0.2.1', tag: '0.2.1', commit: 'cccccccccccccccccccccccccccccccccccccccc' },
                    { version: '0.1.1', tag: 'v0.1.1', commit: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' },
                    { version: '0.1.0', tag: '0.1.0', commit: 'dddddddddddddddddddddddddddddddddddddddd' }
                ]);
                next();
            })
            .done();
        });

        it('should order the versions according to the semver spec', function (next) {
            GitResolver.fetchRefs = function () {
                // TODO: Uncomment this out as soon as semver solves the issue with builds
                //       See: https://github.com/isaacs/node-semver/issues/16
                return Q.resolve([
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/tags/0.1.0',
                    //'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags/0.1.1+build.11',
                    //'cccccccccccccccccccccccccccccccccccccccc refs/tags/0.1.1+build.100',
                    //'dddddddddddddddddddddddddddddddddddddddd refs/tags/0.1.1-rc.22',
                    //'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee refs/tags/0.1.1-rc.200',
                    'ffffffffffffffffffffffffffffffffffffffff refs/tags/0.1.1',
                    'abbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags/v0.2.1'
                ]);
            };

            GitResolver.fetchVersions('foo')
            .then(function (versions) {
                expect(versions).to.eql([
                    { version: '0.2.1', tag: 'v0.2.1', commit: 'abbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
                    //{ version: '0.1.1+build.100', tag: '0.1.1+build.100', commit: 'cccccccccccccccccccccccccccccccccccccccc' },
                    //{ version: '0.1.1+build.11', tag: '0.1.1+build.11', commit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
                    { version: '0.1.1', tag: '0.1.1', commit: 'ffffffffffffffffffffffffffffffffffffffff' },
                    //{ version: '0.1.1-rc.200', tag: '0.1.1-rc.200', commit: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' },
                    //{ version: '0.1.1-rc.22', tag: '0.1.1-rc.22', commit: 'dddddddddddddddddddddddddddddddddddddddd' },
                    { version: '0.1.0', tag: '0.1.0', commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }
                ]);
                next();
            })
            .done();
        });

        it('should cache the result for each source', function (next) {
            GitResolver.fetchRefs = function (source) {
                if (source === 'foo') {
                    return Q.resolve([
                        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/tags/0.2.1',
                        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags/0.1.0'
                    ]);
                }

                return Q.resolve([
                    'cccccccccccccccccccccccccccccccccccccccc refs/tags/0.3.1',
                    'dddddddddddddddddddddddddddddddddddddddd refs/tags/0.3.0'
                ]);
            };

            GitResolver.fetchVersions('foo')
            .then(function (versions) {
                expect(versions).to.eql([
                    { version: '0.2.1', tag: '0.2.1', commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
                    { version: '0.1.0', tag: '0.1.0', commit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' }
                ]);

                return GitResolver.fetchVersions('bar');
            })
            .then(function (versions) {
                expect(versions).to.eql([
                    { version: '0.3.1', tag: '0.3.1', commit: 'cccccccccccccccccccccccccccccccccccccccc' },
                    { version: '0.3.0', tag: '0.3.0', commit: 'dddddddddddddddddddddddddddddddddddddddd' }
                ]);

                // Test for the cache
                expect(GitResolver._versions).to.be.an('object');
                expect(GitResolver._versions.foo).to.be.an('array');
                expect(GitResolver._versions.bar).to.be.an('array');

                // Manipulate the cache and check if it resolves for the cached ones
                GitResolver._versions.foo.splice(1, 1);
                GitResolver._versions.bar.splice(1, 1);

                return GitResolver.fetchVersions('foo');
            })
            .then(function (versions) {
                expect(versions).to.eql([
                    { version: '0.2.1', tag: '0.2.1', commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }
                ]);

                return GitResolver.fetchVersions('bar');
            })
            .then(function (versions) {
                expect(versions).to.eql([
                    { version: '0.3.1', tag: '0.3.1', commit: 'cccccccccccccccccccccccccccccccccccccccc' }
                ]);

                next();
            })
            .done();
        });
    });
});