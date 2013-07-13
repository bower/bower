var expect = require('expect.js');
var Q = require('q');
var path = require('path');
var mout = require('mout');
var fs = require('graceful-fs');
var rimraf = require('rimraf');
var RegistryClient = require('bower-registry-client');
var proxyquire = require('proxyquire');
var defaultConfig = require('../../lib/config');
var Logger = require('../../lib/core/Logger');
var resolvers = require('../../lib/core/resolvers');
var copy = require('../../lib/util/copy');

describe('PackageRepository', function () {
    var packageRepository;
    var resolver;
    var resolverFactoryHook;
    var testPackage = path.resolve(__dirname, '../assets/github-test-package');
    var tempPackage = path.resolve(__dirname, '../assets/temp');
    var packagesCacheDir = path.join(__dirname, '../assets/temp-resolve-cache');
    var registryCacheDir = path.join(__dirname, '../assets/temp-registry-cache');

    beforeEach(function (next) {
        var PackageRepository;
        var config;
        var logger = new Logger();

        // Config
        config = mout.object.deepMixIn({}, defaultConfig, {
            storage: {
                packages: packagesCacheDir,
                registry: registryCacheDir
            }
        });

        function resolverFactory(decEndpoint, _config, _logger, _registryClient) {
            expect(_config).to.eql(config);
            expect(_logger).to.be.an(Logger);
            expect(_registryClient).to.be.an(RegistryClient);

            decEndpoint = mout.object.deepMixIn({}, decEndpoint);
            decEndpoint.source = 'file://' + testPackage;

            resolver = new resolvers.GitRemote(decEndpoint, _config, _logger);
            resolverFactoryHook(resolver);

            return Q.resolve(resolver);
        }
        resolverFactory.getConstructor = function () {
            return Q.resolve([resolvers.GitRemote, 'file://' + testPackage, false]);
        };

        // Mock the resolver factory to always return a resolver for the test package
        PackageRepository = proxyquire('../../lib/core/PackageRepository', {
            './resolverFactory': resolverFactory
        });
        packageRepository = new PackageRepository(config, logger);

        // Reset hooks
        resolverFactoryHook = function () {};

        // Remove temp package
        rimraf.sync(tempPackage);

        // Clear the repository
        packageRepository.clear()
        .then(next.bind(next, null), next);
    });

    describe('.fetch', function () {
        it('should call the resolver factory to get the appropriate resolver', function (next) {
            var decEndpoint = { name: '', source: 'foo', target: '~0.1.0' };
            var called;

            resolverFactoryHook = function () {
                called = true;
            };

            packageRepository.fetch(decEndpoint)
            .spread(function (canonicalDir, pkgMeta) {
                expect(called).to.be(true);
                expect(fs.existsSync(canonicalDir)).to.be(true);
                expect(pkgMeta).to.be.an('object');
                expect(pkgMeta.name).to.be('github-test-package');
                expect(pkgMeta.version).to.be('0.1.1');
                next();
            })
            .done();
        });

        it('should just call the resolver resolve method if force was specified', function (next) {
            var called = [];

            resolverFactoryHook = function (resolver) {
                var originalResolve = resolver.resolve;

                resolver.resolve = function () {
                    called.push('resolve');
                    return originalResolve.apply(this, arguments);
                };

                resolver.hasNew = function () {
                    called.push('hasNew');
                    return Q.resolve(false);
                };
            };

            packageRepository._resolveCache.retrieve = function () {
                called.push('retrieve');
                return Q.resolve([]);
            };

            packageRepository._config.force = true;
            packageRepository.fetch({ name: '', source: 'foo', target: ' ~0.1.0' })
            .spread(function (canonicalDir, pkgMeta) {
                expect(called).to.eql(['resolve']);
                expect(fs.existsSync(canonicalDir)).to.be(true);
                expect(pkgMeta).to.be.an('object');
                expect(pkgMeta.name).to.be('github-test-package');
                expect(pkgMeta.version).to.be('0.1.1');
                next();
            })
            .done();
        });

        it('should attempt to retrieve a resolved package from the resolve package', function (next) {
            var called;
            var originalRetrieve = packageRepository._resolveCache.retrieve;

            packageRepository._resolveCache.retrieve = function () {
                called = true;
                return originalRetrieve.apply(this, arguments);
            };

            packageRepository.fetch({ name: '', source: 'foo', target: '~0.2.1' })
            .spread(function (canonicalDir, pkgMeta) {
                expect(called).to.be(true);
                expect(fs.existsSync(canonicalDir)).to.be(true);
                expect(pkgMeta).to.be.an('object');
                expect(pkgMeta.name).to.be('test-package');
                expect(pkgMeta.version).to.be('0.2.1');
                next();
            })
            .done();
        });

        it('should just call the resolver resolve method if no appropriate package was found in the resolve cache', function (next) {
            var called = [];

            resolverFactoryHook = function (resolver) {
                var originalResolve = resolver.resolve;

                resolver.resolve = function () {
                    called.push('resolve');
                    return originalResolve.apply(this, arguments);
                };

                resolver.hasNew = function () {
                    called.push('hasNew');
                };
            };

            packageRepository._resolveCache.retrieve = function () {
                return Q.resolve([]);
            };

            packageRepository.fetch({ name: '', source: 'foo', target: ' ~0.1.0' })
            .spread(function (canonicalDir, pkgMeta) {
                expect(called).to.eql(['resolve']);
                expect(fs.existsSync(canonicalDir)).to.be(true);
                expect(pkgMeta).to.be.an('object');
                expect(pkgMeta.name).to.be('github-test-package');
                expect(pkgMeta.version).to.be('0.1.1');
                next();
            })
            .done();
        });

        it('should call the resolver hasNew method if an appropriate package was found in the resolve cache', function (next) {
            var pkgMeta = {
                name: 'test-package',
                version: '0.2.1'
            };
            var called;

            resolverFactoryHook = function (resolver) {
                var originalHasNew = resolver.hasNew;

                resolver.hasNew = function () {
                    called = true;
                    return originalHasNew.apply(this, arguments);
                };
            };

            packageRepository._resolveCache.retrieve = function () {
                return Q.resolve([tempPackage, pkgMeta]);
            };

            copy.copyDir(testPackage, tempPackage, { ignore: ['.git'] })
            .then(function () {
                fs.writeFileSync(path.join(tempPackage, '.bower.json'), JSON.stringify(pkgMeta));

                return packageRepository.fetch({ name: '', source: 'foo', target: '~0.1.0' })
                .spread(function (canonicalDir, pkgMeta) {
                    expect(called).to.be(true);
                    expect(fs.existsSync(canonicalDir)).to.be(true);
                    expect(pkgMeta).to.be.an('object');
                    expect(pkgMeta.name).to.be('github-test-package');
                    expect(pkgMeta.version).to.be('0.1.1');
                    next();
                });
            })
            .done();
        });

        it('should call the resolver resolve method if hasNew resolved to true', function (next) {
            var json = {
                name: 'test-package',
                version: '0.2.0'
            };
            var called = [];

            resolverFactoryHook = function (resolver) {
                var originalResolve = resolver.resolve;

                resolver.resolve = function () {
                    called.push('resolve');
                    return originalResolve.apply(this, arguments);
                };

                resolver.hasNew = function () {
                    called.push('hasNew');
                    return Q.resolve(true);
                };
            };

            packageRepository._resolveCache.retrieve = function () {
                return Q.resolve([tempPackage, json]);
            };

            copy.copyDir(testPackage, tempPackage, { ignore: ['.git'] })
            .then(function () {
                fs.writeFileSync(path.join(tempPackage, '.bower.json'), JSON.stringify(json));

                return packageRepository.fetch({ name: '', source: 'foo', target: '~0.2.0' })
                .spread(function (canonicalDir, pkgMeta) {
                    expect(called).to.eql(['hasNew', 'resolve']);
                    expect(fs.existsSync(canonicalDir)).to.be(true);
                    expect(pkgMeta).to.be.an('object');
                    expect(pkgMeta.name).to.be('test-package');
                    expect(pkgMeta.version).to.be('0.2.1');
                    next();
                });
            })
            .done();
        });

        it('should resolve to the cached package if hasNew resolve to false', function (next) {
            var json = {
                name: 'test-package',
                version: '0.2.0'
            };
            var called = [];

            resolverFactoryHook = function (resolver) {
                var originalResolve = resolver.resolve;

                resolver.resolve = function () {
                    called.push('resolve');
                    return originalResolve.apply(this, arguments);
                };

                resolver.hasNew = function () {
                    called.push('hasNew');
                    return Q.resolve(false);
                };
            };

            packageRepository._resolveCache.retrieve = function () {
                return Q.resolve([tempPackage, json]);
            };

            copy.copyDir(testPackage, tempPackage, { ignore: ['.git'] })
            .then(function () {
                fs.writeFileSync(path.join(tempPackage, '.bower.json'), JSON.stringify(json));

                return packageRepository.fetch({ name: '', source: 'foo', target: '~0.2.0' })
                .spread(function (canonicalDir, pkgMeta) {
                    expect(called).to.eql(['hasNew']);
                    expect(canonicalDir).to.equal(tempPackage);
                    expect(pkgMeta).to.eql(json);
                    next();
                });
            })
            .done();
        });

        it('should just use the cached package if offline was specified', function (next) {
            var json = {
                name: 'test-package',
                version: '0.2.0'
            };
            var called = [];

            resolverFactoryHook = function (resolver) {
                var originalResolve = resolver.resolve;

                resolver.resolve = function () {
                    called.push('resolve');
                    return originalResolve.apply(this, arguments);
                };

                resolver.hasNew = function () {
                    called.push('hasNew');
                    return Q.resolve(false);
                };
            };

            packageRepository._resolveCache.retrieve = function () {
                return Q.resolve([tempPackage, json]);
            };

            copy.copyDir(testPackage, tempPackage, { ignore: ['.git'] })
            .then(function () {
                fs.writeFileSync(path.join(tempPackage, '.bower.json'), JSON.stringify(json));

                packageRepository._config.offline = true;
                return packageRepository.fetch({ name: '', source: 'foo', target: '~0.2.0' })
                .spread(function (canonicalDir, pkgMeta) {
                    expect(called.length).to.be(0);
                    expect(canonicalDir).to.equal(tempPackage);
                    expect(pkgMeta).to.eql(json);
                    next();
                });
            })
            .done();
        });

        it('should error out if there is no appropriate package in the resolve cache and offline was specified', function (next) {
            packageRepository._config.offline = true;
            packageRepository.fetch({ name: '', source: 'foo', target: '~0.2.0' })
            .then(function () {
                throw new Error('Should have failed');
            }, function (err) {
                expect(err).to.be.an(Error);
                expect(err.code).to.equal('ENOCACHE');

                next();
            })
            .done();
        });
    });

    describe('.versions', function () {
        it('should call the versions method on the concrete resolver', function (next) {
            var called = [];
            var originalVersions = resolvers.GitRemote.versions;

            resolvers.GitRemote.versions = function () {
                called.push('resolver');
                return Q.resolve([]);
            };

            packageRepository._resolveCache.versions = function () {
                called.push('resolve-cache');
                return Q.resolve([]);
            };

            packageRepository.versions('foo')
            .then(function (versions) {
                expect(called).to.eql(['resolver']);
                expect(versions).to.be.an('array');
                expect(versions.length).to.be(0);

                next();
            })
            .fin(function () {
                resolvers.GitRemote.versions = originalVersions;
            })
            .done();
        });

        it('should call the versions method on the resolve cache if offline was specified', function (next) {
            var called = [];
            var originalVersions = resolvers.GitRemote.versions;

            resolvers.GitRemote.versions = function () {
                called.push('resolver');
                return Q.resolve([]);
            };

            packageRepository._resolveCache.versions = function () {
                called.push('resolve-cache');
                return Q.resolve([]);
            };

            packageRepository._config.offline = true;
            packageRepository.versions('foo')
            .then(function (versions) {
                expect(called).to.eql(['resolve-cache']);
                expect(versions).to.be.an('array');
                expect(versions.length).to.be(0);

                next();
            })
            .fin(function () {
                resolvers.GitRemote.versions = originalVersions;
            })
            .done();
        });
    });

    describe('.eliminate', function () {
        it('should call the eliminate method from the resolve cache');
        it('should call the clearCache method with the name from the registry client');
    });

    describe('.list', function () {
        it('should proxy to the resolve cache list method');
    });

    describe('.clear', function () {
        it('should call the clear method from the resolve cache');
        it('should call the clearCache method without name from the registry client');
    });

    describe('.reset', function () {
        it('should call the reset method from the resolve cache');
        it('should call the resetCache method without name from the registry client');
    });

    describe('#clearRuntimeCache', function () {
        it('should clear the resolve runtime cache');
        it('should clear the resolver factory runtime cache');
        it('should clear the registry runtime cache');
    });
});
