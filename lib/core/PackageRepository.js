var mout = require('mout');
var RegistryClient = require('bower-registry-client');
var ResolveCache = require('./ResolveCache');
var resolverFactory = require('./resolverFactory');
var defaultConfig = require('../config');

var PackageRepository = function (options) {
    options = options || {};

    this._options = options;
    this._config = options.config || defaultConfig;

    // Instantiate the registry and store it in the options object
    // because it will be passed to the resolver factory
    this._options.registry = new RegistryClient(mout.object.fillIn({
        cache: this._config._registry
    }, options.config));

    this._cache = new ResolveCache(this._config._cache);
};

// -----------------

PackageRepository.prototype.fetch = function (decEndpoint) {
    var resolver;

    // Get the appropriate resolver
    return resolverFactory(decEndpoint, this._options)
    // Retrieve from the resolve cache
    .then(function (res) {
        resolver = res;

        // If force flag is used, bypass cache
        if (this._options.force) {
            return [];
        }

        // Note that we use the resolver methods to query the
        // cache because transformations/normalisations can occur
        return this._cache.retrieve(resolver.getSource(), resolver.getTarget());
    }.bind(this))
    // Decide if we can use the one from the resolve cache
    .spread(function (canonicalPkg, pkgMeta) {
        // If there's no package in the cache, resolve it
        if (!canonicalPkg) {
            return this._resolve(resolver);
        }

        // If offline flag is used, use directly the cached one
        if (this._options.offline) {
            return [canonicalPkg, pkgMeta];
        }

        // Otherwise check for new contents
        return resolver.hasNew(canonicalPkg, pkgMeta)
        .then(function (hasNew) {
            // If there are no new contents, resolve to
            // the cached one
            if (!hasNew) {
                return [canonicalPkg, pkgMeta];
            }

            // Otherwise resolve to the newest one
            return this._resolve(resolver);
        });
    }.bind(this));
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
        return this._cache.store(canonicalPkg, resolver.getPkgMeta());
    }.bind(this))
    // Resolve promise with canonical package and package meta
    .then(function () {
        return [resolver.getTempDir(), resolver.getPkgMeta()];
    }.bind(this));
};

module.exports = PackageRepository;