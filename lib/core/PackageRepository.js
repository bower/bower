var mout = require('mout');
var Q = require('q');
var RegistryClient = require('bower-registry-client');
var ResolveCache = require('./ResolveCache');
var resolverFactory = require('./resolverFactory');
var defaultConfig = require('../config');
var createError = require('../util/createError');

function PackageRepository(config) {
    var registryOptions;

    this._config = config || defaultConfig;

    // Instantiate the registry
    registryOptions = mout.object.deepMixIn({}, this._config);
    registryOptions.cache = this._config.roaming.registry;
    this._registryClient = new RegistryClient(registryOptions);

    // Instantiate the resolve cache
    this._resolveCache = new ResolveCache(this._config.roaming.cache);
}

// -----------------

PackageRepository.prototype.fetch = function (decEndpoint) {
    var resolver;
    var pkgMeta;
    var canonicalPkg;
    var deferred = Q.defer();
    var that = this;

    // Get the appropriate resolver
    resolverFactory(decEndpoint, this._registryClient, this._config)
    // Decide if we retrieve from the cache or not
    // Also decide we if validate the cached entry or not
    .then(function (res) {
        resolver = res;

        // If force flag is used, bypass cache
        if (that._config.force) {
            return that._resolve(resolver)
            // We have to listen to the progress and return it back
            // otherwise it won't be propagated (wtf?)
            .progress(function (notification) {
                return notification;
            });
        }

        // Note that we use the resolver methods to query the
        // cache because transformations/normalisations can occur
        return that._resolveCache.retrieve(resolver.getSource(), resolver.getTarget())
        // Decide if we can use the one from the resolve cache
        .spread(function (canonical, meta) {
            // If there's no package in the cache
            if (!canonical) {
                // And the offline flag is passed, error out
                if (that._config.offline) {
                    throw createError('No cached version for ' + resolver.getSource() + '#' + resolver.getTarget(), 'ENOCACHE', {
                        resolver: resolver
                    });
                }

                // Otherwise, we have to resolve it
                deferred.notify({
                    level: 'info',
                    id: 'not-cached',
                    message: resolver.getSource() + (resolver.getTarget() ? '#' + resolver.getTarget() : '')
                });

                return that._resolve(resolver);
            }

            canonicalPkg = canonical;
            pkgMeta = meta;

            deferred.notify({
                level: 'info',
                id: 'cached',
                message: resolver.getSource() + (pkgMeta._release ? '#' + pkgMeta._release : '')
            });

            // If offline flag is used, use directly the cached one
            if (that._config.offline) {
                return [canonicalPkg, pkgMeta];
            }

            // Otherwise check for new contents
            process.nextTick(function () {
                deferred.notify({
                    level: 'action',
                    id: 'validate',
                    message: (pkgMeta._release ? pkgMeta._release + ' against ': '') +
                             resolver.getSource() + (resolver.getTarget() ? '#' + resolver.getTarget() : '')
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
                    id: 'new',
                    message: 'version for ' + resolver.getSource() + '#' + resolver.getTarget()
                });

                return that._resolve(resolver);
            });
        });
    })
    .then(deferred.resolve, deferred.reject, function (notification) {
        // Store the resolver info in each notification
        if (resolver) {
            notification.resolver = {
                name: resolver.getName(),
                source: resolver.getSource(),
                target: resolver.getTarget()
            };
        }

        // Store the canonical package and it's meta in each notification
        if (canonicalPkg) {
            notification.data = notification.data || {};
            notification.data.canonicalPkg = canonicalPkg;
            notification.data.pkgMeta = pkgMeta;
        }

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
    var deferred = Q.defer();

    process.nextTick(function () {
        deferred.notify({
            level: 'action',
            id: 'resolve',
            message: resolver.getSource() + '#' + resolver.getTarget()
        });
    });

    // Resolve the resolver
    resolver.resolve()
    // Store in the cache
    .then(function (canonicalPkg) {
        return this._resolveCache.store(canonicalPkg, resolver.getPkgMeta());
    }.bind(this))
    // Resolve promise with canonical package and package meta
    .then(function (dir) {
        return [dir, resolver.getPkgMeta()];
    }.bind(this))
    .then(deferred.resolve, deferred.reject, deferred.notify);

    return deferred.promise;
};

module.exports = PackageRepository;
