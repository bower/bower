var expect = require('expect.js');
var Q = require('q');
var GitResolver = require('../../../lib/resolve/resolvers/GitResolver');

describe('GitResolver', function () {
    beforeEach(function () {
        GitResolver.fetchRefs = function () {};
        delete GitResolver._versions;
        delete GitResolver._heads;
        delete GitResolver._refs;
    });

    describe('hasNew', function () {
        it('should return a promise');
        it('should be true when the resolution type is different');
        it('should be true when a different tag (higher/lower) for a range is available');
        it('should be false when resolved to the same tag for a given range');
        it('should be true when a different commit hash for a given branch is available');
        it('should be false when resolved to the the same commit hash for a given branch');
        it('should be false when targeting commit hashes');
        it('should resolve to the master branch when the target is *');
    });

    describe('resolve', function () {
        it('should return a promise');
        it('should call the necessary functions by thee correct order');
    });

    describe('._findResolution', function () {
        it('should return a promise');
    });

    describe('._cleanup', function () {
        it('should return a promise');
        it('should remove the .git folder from the temp dir');
    });

    describe('._savePkgMeta', function () {
        it('should return a promise');
        it('should save the resolution to the json to be used later by .hasNew');
    });

    describe('#fetchHeads', function () {
        it('should return a promise');
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
        it('should return a promise');
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
                    '0.2.1',
                    '0.1.1',
                    '0.1.0'
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
                    //'cccccccccccccccccccccccccccccccccccccccc refs/tags/0.1.1+build.11',
                    //'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags/0.1.1+build.100',
                    //'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee refs/tags/0.1.1-rc.22',
                    //'dddddddddddddddddddddddddddddddddddddddd refs/tags/0.1.1-rc.200',
                    'ffffffffffffffffffffffffffffffffffffffff refs/tags/0.1.1',
                    'abbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags/v0.2.1'
                ]);
            };

            GitResolver.fetchVersions('foo')
            .then(function (versions) {
                expect(versions).to.eql([
                    '0.2.1',
                    //'0.1.1+build.100',
                    //'0.1.1+build.11',
                    '0.1.1',
                    //'0.1.1-rc.200',
                    //'0.1.1-rc.22',
                    '0.1.0'
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
                expect(versions).to.eql(['0.2.1', '0.1.0']);

                return GitResolver.fetchVersions('bar');
            })
            .then(function (versions) {
                expect(versions).to.eql(['0.3.1', '0.3.0']);

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
                expect(versions).to.eql(['0.2.1']);

                return GitResolver.fetchVersions('bar');
            })
            .then(function (versions) {
                expect(versions).to.eql(['0.3.1']);

                next();
            })
            .done();
        });
    });
});