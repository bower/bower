var expect = require('expect.js');
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var mout = require('mout');
var Q = require('q');
var rimraf = require('rimraf');
var RegistryClient = require('bower-registry-client');
var defaultConfig = require('../../lib/config');
var resolverFactory = require('../../lib/core/resolverFactory');
var FsResolver = require('../../lib/core/resolvers/FsResolver');
var GitFsResolver = require('../../lib/core/resolvers/GitFsResolver');
var GitRemoteResolver = require('../../lib/core/resolvers/GitRemoteResolver');
var UrlResolver = require('../../lib/core/resolvers/UrlResolver');

describe('resolverFactory', function () {
    var tempSource;
    var registryClient = new RegistryClient(mout.object.fillIn({
        cache: defaultConfig._registry
    }, defaultConfig));

    afterEach(function (next) {
        if (tempSource) {
            rimraf(tempSource, next);
            tempSource = null;
        } else {
            next();
        }
    });

    it('should recognize git remote endpoints correctly', function (next) {
        var promise = Q.resolve();
        var endpoints;

        endpoints = {
            // git:
            'git://github.com/user/project.git': 'git://github.com/user/project.git',
            'git://github.com/user/project.git/': 'git://github.com/user/project.git',

            // git+ssh:
            'git+ssh://user@hostname:project': 'ssh://user@hostname:project.git',
            'git+ssh://user@hostname:project/': 'ssh://user@hostname:project.git',
            'git+ssh://user@hostname:project.git': 'ssh://user@hostname:project.git',
            'git+ssh://user@hostname:project.git/': 'ssh://user@hostname:project.git',
            'git+ssh://user@hostname/project': 'ssh://user@hostname/project.git',
            'git+ssh://user@hostname/project/': 'ssh://user@hostname/project.git',
            'git+ssh://user@hostname/project.git': 'ssh://user@hostname/project.git',
            'git+ssh://user@hostname/project.git/': 'ssh://user@hostname/project.git',

            // git+http
            'git+http://user@hostname/project/blah': 'http://user@hostname/project/blah.git',
            'git+http://user@hostname/project/blah/': 'http://user@hostname/project/blah.git',
            'git+http://user@hostname/project/blah.git': 'http://user@hostname/project/blah.git',
            'git+http://user@hostname/project/blah.git/': 'http://user@hostname/project/blah.git',

            // git+https
            'git+https://user@hostname/project/blah': 'https://user@hostname/project/blah.git',
            'git+https://user@hostname/project/blah/': 'https://user@hostname/project/blah.git',
            'git+https://user@hostname/project/blah.git': 'https://user@hostname/project/blah.git',
            'git+https://user@hostname/project/blah.git/': 'https://user@hostname/project/blah.git',

            // ssh .git$
            'ssh://user@hostname:project.git': 'ssh://user@hostname:project.git',
            'ssh://user@hostname:project.git/': 'ssh://user@hostname:project.git',
            'ssh://user@hostname/project.git': 'ssh://user@hostname/project.git',
            'ssh://user@hostname/project.git/': 'ssh://user@hostname/project.git',

            // http .git&
            'http://user@hostname/project.git': 'http://user@hostname/project.git',
            'http://user@hostname/project.git/': 'http://user@hostname/project.git',

            // https
            'https://user@hostname/project.git': 'https://user@hostname/project.git',
            'https://user@hostname/project.git/': 'https://user@hostname/project.git',

            // shorthand
            'bower/bower': 'git://github.com/bower/bower.git'
        };

        mout.object.forOwn(endpoints, function (value, key) {
            // Test without name and target
            promise = promise.then(function () {
                return resolverFactory({
                    source: key
                }, registryClient);
            })
            .then(function (resolver) {
                expect(resolver).to.be.a(GitRemoteResolver);
                expect(resolver.getSource()).to.equal(value);
                expect(resolver.getTarget()).to.equal('*');
            });

            // Test with target
            promise = promise.then(function () {
                return resolverFactory({
                    source: key,
                    target: 'commit-ish'
                }, registryClient);
            })
            .then(function (resolver) {
                expect(resolver).to.be.a(GitRemoteResolver);
                expect(resolver.getSource()).to.equal(value);
                expect(resolver.getTarget()).to.equal('commit-ish');
            });

            // Test with name
            promise = promise.then(function () {
                return resolverFactory({
                    name: 'foo',
                    source: key
                }, registryClient);
            })
            .then(function (resolver) {
                expect(resolver).to.be.a(GitRemoteResolver);
                expect(resolver.getSource()).to.equal(value);
                expect(resolver.getName()).to.equal('foo');
                expect(resolver.getTarget()).to.equal('*');
            });
        });

        promise
        .then(next.bind(next, null))
        .done();
    });

    it('should recognize local fs git endpoints correctly', function (next) {
        var promise = Q.resolve();
        var endpoints;
        var temp;

        endpoints = {};

        // Absolute path
        temp = path.resolve(__dirname, '../assets/github-test-package');
        endpoints[temp] = temp;

        // Relative path
        endpoints[__dirname + '/../assets/github-test-package'] = temp;

        mout.object.forOwn(endpoints, function (value, key) {
            // Test without name
            promise = promise.then(function () {
                return resolverFactory({
                    source: key
                }, registryClient);
            })
            .then(function (resolver) {
                expect(resolver).to.be.a(GitFsResolver);
                expect(resolver.getTarget()).to.equal('*');
            });

            // Test with name
            promise = promise.then(function () {
                return resolverFactory({
                    name: 'foo',
                    source: key
                }, registryClient);
            })
            .then(function (resolver) {
                expect(resolver).to.be.a(GitFsResolver);
                expect(resolver.getName()).to.equal('foo');
                expect(resolver.getTarget()).to.equal('*');
            });
        });

        promise
        .then(next.bind(next, null))
        .done();
    });

    it('should recognize local fs files/folder endpoints correctly', function (next) {
        var promise = Q.resolve();
        var endpoints;
        var temp;

        tempSource = path.resolve(__dirname, '../assets/tmp');
        mkdirp.sync(tempSource);
        fs.writeFileSync(path.join(tempSource, '.git'), 'foo');

        endpoints = {};

        // Absolute path to folder with .git file
        endpoints[tempSource] = tempSource;
        // Relative path to folder with .git file
        endpoints[__dirname + '/../assets/tmp'] = tempSource;

        // Absolute path to folder
        temp = path.resolve(__dirname, '../assets/test-temp-dir');
        endpoints[temp] = temp;
        // Relative path to folder
        endpoints[__dirname + '/../assets/test-temp-dir'] = temp;

        // Absolute path to file
        temp = path.resolve(__dirname, '../assets/package-zip.zip');
        endpoints[temp] = temp;
        // Relative path to file
        endpoints[__dirname + '/../assets/package-zip.zip'] = temp;

        // Relative with just one slash, to test fs resolution
        // priority against shorthands
        endpoints['test/assets'] = path.resolve(process.cwd() + '/test/assets');

        mout.object.forOwn(endpoints, function (value, key) {
            // Test without name
            promise = promise.then(function () {
                return resolverFactory({
                    source: key
                }, registryClient);
            })
            .then(function (resolver) {
                expect(resolver).to.be.a(FsResolver);
                expect(resolver.getTarget()).to.equal('*');
            });

            // Test with name
            promise = promise.then(function () {
                return resolverFactory({
                    name: 'foo',
                    source: key
                }, registryClient);
            })
            .then(function (resolver) {
                expect(resolver).to.be.a(FsResolver);
                expect(resolver.getName()).to.equal('foo');
                expect(resolver.getTarget()).to.equal('*');
            });
        });


        promise
        .then(next.bind(next, null))
        .done();
    });

    it('should recognize URL endpoints correctly', function (next) {
        var promise = Q.resolve();
        var endpoints;

        endpoints = [
            'http://bower.io/foo.js',
            'https://bower.io/foo.js'
        ];

        endpoints.forEach(function (source) {
            // Test without name
            promise = promise.then(function () {
                return resolverFactory({
                    source: source
                }, registryClient);
            })
            .then(function (resolver) {
                expect(resolver).to.be.a(UrlResolver);
            });

            // Test with name
            promise = promise.then(function () {
                return resolverFactory({
                    name: 'foo',
                    source: source
                }, registryClient);
            })
            .then(function (resolver) {
                expect(resolver).to.be.a(UrlResolver);
            });
        });

        promise
        .then(next.bind(next, null))
        .done();
    });

    it('should recognize registry endpoints correctly', function (next) {
        resolverFactory({
            source: 'dejavu'
        }, registryClient)
        .then(function (resolver) {
            expect(resolver).to.be.a(GitRemoteResolver);
            expect(resolver.getSource()).to.equal('git://github.com/IndigoUnited/dejavu.git');
            expect(resolver.getTarget()).to.equal('*');
        })
        .then(function () {
            return resolverFactory({
                source: 'dejavu',
                name: 'foo'
            }, registryClient)
            .then(function (resolver) {
                expect(resolver).to.be.a(GitRemoteResolver);
                expect(resolver.getSource()).to.equal('git://github.com/IndigoUnited/dejavu.git');
                expect(resolver.getName()).to.equal('foo');
                expect(resolver.getTarget()).to.equal('*');
            });
        })
        .then(function () {
            return resolverFactory({
                source: 'dejavu',
                target: '~2.0.0'
            }, registryClient)
            .then(function (resolver) {
                expect(resolver).to.be.a(GitRemoteResolver);
                expect(resolver.getTarget()).to.equal('~2.0.0');

                next();
            });
        })
        .done();
    });

    it('should use the configured shorthand resolver', function (next) {
        resolverFactory({
            source: 'bower/bower'
        }, registryClient)
        .then(function (resolver) {
            expect(resolver.getSource()).to.equal('git://github.com/bower/bower.git');

            return resolverFactory({
                source: 'IndigoUnited/promptly'
            }, registryClient, mout.object.fillIn({
                shorthandResolver: 'git://bower.io/{{owner}}/{{package}}/{{shorthand}}'
            }, defaultConfig));
        })
        .then(function (resolver) {
            expect(resolver.getSource()).to.equal('git://bower.io/IndigoUnited/promptly/IndigoUnited/promptly.git');
            next();
        })
        .done();
    });

    it.skip('should use config.cwd when resolving relative paths', function () {

    });

    it.skip('should pass offline and force options to the registry lookup');

    it('should not swallow constructor errors when instantiating resolvers', function (next) {
        var promise = Q.resolve();
        var endpoints;

        // TODO: test with others
        endpoints = [
            'http://bower.io/foo.js',
            path.resolve(__dirname, '../assets/test-temp-dir')
        ];

        endpoints.forEach(function (source) {
            promise = promise.then(function () {
                return resolverFactory({
                    source: source,
                    target: 'bleh'
                }, registryClient);
            })
            .then(function () {
                throw new Error('Should have failed');
            }, function (err) {
                expect(err).to.be.an(Error);
                expect(err.message).to.match(/can't resolve targets/i);
                expect(err.code).to.equal('ENORESTARGET');
            });
        });

        promise
        .then(next.bind(next, null))
        .done();
    });
});

