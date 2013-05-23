var mout = require('mout');
var Q = require('q');
var RegistryClient = require('bower-registry-client');
var ResolveCache = require('./ResolveCache');
var resolverFactory = require('./resolverFactory');
var defaultConfig = require('../config');
var createError = require('../util/createError');

var PackageRepository = function (options) {
    options = options || {};
    options.config = options.config || defaultConfig;

    this._options = options;
    this._config = options.config;

    // Instantiate the registry and store it in the options object
    // because it will be passed to the resolver factory
    this._options.registryClient = new RegistryClient(mout.object.fillIn({
        cache: this._config.roaming.registry
    }, this._config));

    this._resolveCache = new ResolveCache(this._config.roaming.cache);
};

// -----------------

PackageRepository.prototype.fetch = function (decEndpoint) {
    var res;
    var deferred = Q.defer();
    var that = this;

    // Get the appropriate resolver
    resolverFactory(decEndpoint, this._options)
    // Decide if we retrieve from the cache or not
    // Also decide we if validate the cached entry or not
    .then(function (resolver) {
        res = resolver;

        // Set the resolver name in the decEndpoint
        decEndpoint.resolverName = resolver.getName();

        // If force flag is used, bypass cache
        if (that._options.force) {
            deferred.notify({
                level: 'action',
                tag: 'resolve',
                resolver: resolver,
                data: 'Resolving ' + resolver.getSource(),
            });
            return that._resolve(resolver);
        }

        // Note that we use the resolver methods to query the
        // cache because transformations/normalisations can occur
        return that._resolveCache.retrieve(resolver.getSource(), resolver.getTarget())
        // Decide if we can use the one from the resolve cache
        .spread(function (canonicalPkg, pkgMeta) {
            // If there's no package in the cache
            if (!canonicalPkg) {
                // And the offline flag is passed, error out
                if (that._options.offline) {
                    throw createError('No cached version for ' + resolver.getSource() + '#' + resolver.getTarget(), 'ENOCACHE', {
                        resolver: resolver
                    });
                }

                // Otherwise, we have to resolve it
                deferred.notify({
                    level: 'info',
                    tag: 'not-cached',
                    data: 'No cached version for ' + resolver.getSource() + '#' + resolver.getTarget(),
                });
                deferred.notify({
                    level: 'action',
                    tag: 'resolve',
                    resolver: resolver,
                    data: 'Resolving ' + resolver.getSource() + '#' + resolver.getTarget(),
                });

                return that._resolve(resolver);
            }

            deferred.notify({
                level: 'info',
                tag: 'cached',
                data: 'Got cached ' + resolver.getSource() + (pkgMeta._release ? '#' + pkgMeta._release: '') + ' entry',
                canonicalPkg: canonicalPkg,
                pkgMeta: pkgMeta
            });

            // If offline flag is used, use directly the cached one
            if (that._options.offline) {
                return [canonicalPkg, pkgMeta];
            }

            // Otherwise check for new contents
            process.nextTick(function () {
                deferred.notify({
                    level: 'action',
                    tag: 'check',
                    data: 'Checking ' + resolver.getSource() + '#' + resolver.getTarget() + ' for newer version',
                    canonicalPkg: canonicalPkg,
                    pkgMeta: pkgMeta,
                    resolver: resolver
                });
            });

            return resolver.hasNew(canonicalPkg, pkgMeta)
            .then(function (hasNew) {
                // If there are no new contents, resolve to
                // the cached one
                if (!hasNew) {
                    return [canonicalPkg, pkgMeta];
                }

                // Otherwise resolve to the newest one
                deferred.notify({
                    type: 'info',
                    data: 'There\'s a new version for ' + resolver.getSource() + '#' + resolver.getTarget(),
                    canonicalPkg: canonicalPkg,
                    pkgMeta: pkgMeta,
                    resolver: resolver
                });
                deferred.notify({
                    type: 'resolve',
                    resolver: resolver,
                    data: 'Resolving ' + resolver.getSource() + '#' + resolver.getTarget()
                });

                return that._resolve(resolver);
            });
        });
    })
    .then(deferred.resolve, deferred.reject, function (notification) {
        // Store the resolver for each notification
        notification.resolver = res;
        deferred.notify(notification);
    });

    return deferred.promise;
};

PackageRepository.prototype.empty = function (name) {
    // TODO Think of a way to remove specific packages of a given name from the cache
    //      Since the ResolveCache.empty only works with source, one possible solution is to implement
    //      a forEach method that calls a function with the canonicalPackage and the pkgMeta
    //      so that we can match against the pkgMeta.name and call ResolveCache.empty with it
};

// ---------------------

PackageRepository.prototype._resolve = function (resolver) {
    // Resolve the resolver
    return resolver.resolve()
    // Store in the cache
    .then(function (canonicalPkg) {
        return this._resolveCache.store(canonicalPkg, resolver.getPkgMeta());
    }.bind(this))
    // Resolve promise with canonical package and package meta
    .then(function (dir) {
        return [dir, resolver.getPkgMeta()];
    }.bind(this));
};

module.exports = PackageRepository;
