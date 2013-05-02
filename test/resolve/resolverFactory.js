var expect = require('expect.js');
var fs = require('fs');
var path = require('path');
var mout = require('mout');
var Q = require('q');
var rimraf = require('rimraf');
var resolverFactory = require('../../lib/resolve/resolverFactory');
var FsResolver = require('../../lib/resolve/resolvers/FsResolver');
var GitFsResolver = require('../../lib/resolve/resolvers/GitFsResolver');
var GitRemoteResolver = require('../../lib/resolve/resolvers/GitRemoteResolver');
var UrlResolver = require('../../lib/resolve/resolvers/UrlResolver');

describe('resolverFactory', function () {
    var tempSource;

    afterEach(function (next) {
        if (tempSource) {
            rimraf(tempSource, next);
            tempSource = null;
        } else {
            next();
        }
    });

    it('should recognize git remote endpoints correctly', function (next) {
        var promise = Q.resolve(),
            endpoints;

        endpoints = {
            'git://github.com/user/project.git': {
                source: 'git://github.com/user/project.git',
                target: '*'
            },
            'git://github.com/user/project.git#commit-ish': {
                source: 'git://github.com/user/project.git',
                target: 'commit-ish'
            },
            'git+ssh://user@hostname:project.git': {
                source: 'ssh://user@hostname:project.git',
                target: '*'
            },
            'git+ssh://user@hostname:project.git#commit-ish': {
                source: 'ssh://user@hostname:project.git',
                target: 'commit-ish'
            },
            'git+ssh://user@hostname/project.git': {
                source: 'ssh://user@hostname/project.git',
                target: '*'
            },
            'git+ssh://user@hostname/project.git#commit-ish': {
                source: 'ssh://user@hostname/project.git',
                target: 'commit-ish'
            },
            'user@hostname:project.git': {
                source: 'user@hostname:project.git',
                target: '*'
            },
            'user@hostname:project.git#commit-ish': {
                source: 'user@hostname:project.git',
                target: 'commit-ish'
            },
            'git+http://user@hostname/project/blah.git': {
                source: 'http://user@hostname/project/blah.git',
                target: '*'
            },
            'git+http://user@hostname/project/blah.git#commit-ish': {
                source: 'http://user@hostname/project/blah.git',
                target: 'commit-ish'
            },
            'git+https://user@hostname/project/blah.git': {
                source: 'https://user@hostname/project/blah.git',
                target: '*'
            },
            'git+https://user@hostname/project/blah.git#commit-ish': {
                source: 'https://user@hostname/project/blah.git',
                target: 'commit-ish'
            },
            'bower/bower': {
                source: 'git://github.com/bower/bower.git',
                target: '*'
            },
            'bower/bower#commit-ish': {
                source: 'git://github.com/bower/bower.git',
                target: 'commit-ish'
            },
        };

        mout.object.forOwn(endpoints, function (value, key) {
            promise = promise.then(function () {
                return resolverFactory(key);
            })
            .then(function (resolver) {
                expect(resolver).to.be.a(GitRemoteResolver);
                expect(resolver.getSource()).to.equal(value.source);
                expect(resolver.getTarget()).to.equal(value.target);
            });
        });

        promise
        .then(next.bind(next, null))
        .done();
    });

    it('should recognize local fs git endpoints correctly', function (next) {
        var promise = Q.resolve(),
            endpoints;

        endpoints = [
            path.resolve(__dirname, '../assets/github-test-package'),
            __dirname + '/../assets/github-test-package'
        ];

        endpoints.forEach(function (source) {
            promise = promise.then(function () {
                return resolverFactory(source);
            })
            .then(function (resolver) {
                expect(resolver).to.be.a(GitFsResolver);
            });
        });

        promise
        .then(next.bind(next, null))
        .done();
    });

    it('should recognize local fs files/folder endpoints correctly', function (next) {
        tempSource = path.resolve(__dirname, '../assets/tmp');
        fs.mkdirSync(tempSource);
        fs.writeFileSync(path.join(tempSource, '.git'), 'foo');

        var promise = Q.resolve(),
            endpoints;

        endpoints = [
            tempSource,                                            // folder with .git file (not folder!)
            path.resolve(__dirname, '../assets/test-temp-dir'),    // folder
            path.resolve(__dirname, '../assets/package-zip.zip'),  // file
        ];

        endpoints.forEach(function (source) {
            promise = promise.then(function () {
                return resolverFactory(source);
            })
            .then(function (resolver) {
                expect(resolver).to.be.a(FsResolver);
            });
        });

        promise
        .then(next.bind(next, null))
        .done();
    });

    it('should recognize URL endpoints correctly', function (next) {
        var promise = Q.resolve(),
            endpoints;

        endpoints = [
            'http://bower.io/foo.js',
            'https://bower.io/foo.js'
        ];

        endpoints.forEach(function (source) {
            promise = promise.then(function () {
                return resolverFactory(source);
            })
            .then(function (resolver) {
                expect(resolver).to.be.a(UrlResolver);
            });
        });

        promise
        .then(next.bind(next, null))
        .done();
    });

    it.skip('should recognize registry endpoints correctly');

    it('should use the configured shorthand resolver', function (next) {
        resolverFactory('bower/bower')
        .then(function (resolver) {
            expect(resolver.getSource()).to.equal('git://github.com/bower/bower.git');

            return resolverFactory('IndigoUnited/promptly', {
                shorthandResolver: 'git://bower.io/{{owner}}/{{package}}/{{shorthand}}'
            });
        })
        .then(function (resolver) {
            expect(resolver.getSource()).to.equal('git://bower.io/IndigoUnited/promptly/IndigoUnited/promptly.git');
            next();
        })
        .done();
    });
});