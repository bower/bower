var mout = require('mout');
var RegistryClient = require('bower-registry-client');
var ResolveCache = require('./ResolveCache');
var resolverFactory = require('./resolverFactory');
var createError = require('../util/createError');

function PackageRepository(config) {
    var registryOptions;

    this._config = config;

    // Instantiate the registry
    registryOptions = mout.object.deepMixIn({}, this._config);
    registryOptions.cache = this._config.roaming.registry;
    this._registryClient = new RegistryClient(registryOptions);

    // Instantiate the resolve cache
    this._resolveCache = new ResolveCache(this._config);
}

// -----------------

PackageRepository.prototype.fetch = function (decEndpoint, logger) {
    var info = {};
    var that = this;

    // Intercept all logs, adding additional information
    logger.intercept(this._extendLog.bind(this, info));

    // Get the appropriate resolver
    return resolverFactory(decEndpoint, this._config, logger, this._registryClient)
    // Decide if we retrieve from the cache or not
    // Also decide if we validate the cached entry or not
    .then(function (resolver) {
        info.resolver = resolver;

        // If force flag is used, bypass cache
        if (that._config.force) {
            logger.action('resolve', resolver.getSource() + '#' + resolver.getTarget());
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
                if (that._config.offline) {
                    throw createError('No cached version for ' + resolver.getSource() + '#' + resolver.getTarget(), 'ENOCACHE', {
                        resolver: resolver
                    });
                }

                // Otherwise, we have to resolve it
                logger.info('not-cached', resolver.getSource() + (resolver.getTarget() ? '#' + resolver.getTarget() : ''));
                logger.action('resolve', resolver.getSource() + '#' + resolver.getTarget());

                return that._resolve(resolver);
            }

            info.canonicalPkg = canonicalPkg;
            info.pkgMeta = pkgMeta;

            logger.info('cached', resolver.getSource() + (pkgMeta._release ? '#' + pkgMeta._release : ''));

            // If offline flag is used, use directly the cached one
            if (that._config.offline) {
                return [canonicalPkg, pkgMeta];
            }

            // Otherwise check for new contents
            logger.action('validate', (pkgMeta._release ? pkgMeta._release + ' against ': '') +
                                      resolver.getSource() + (resolver.getTarget() ? '#' + resolver.getTarget() : ''));

            return resolver.hasNew(canonicalPkg, pkgMeta)
            .then(function (hasNew) {
                // If there are no new contents, resolve to
                // the cached one
                if (!hasNew) {
                    return [canonicalPkg, pkgMeta];
                }

                // Otherwise resolve to the newest one
                logger.info('new', 'version for ' + resolver.getSource() + '#' + resolver.getTarget());
                logger.action('resolve', resolver.getSource() + '#' + resolver.getTarget());

                return that._resolve(resolver);
            });
        });
    })
    // If something went wrong, also extend the error
    .fail(function (err) {
        that._extendLog(err, info);
        throw err;
    });
};

PackageRepository.prototype.empty = function (name, logger) {
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

PackageRepository.prototype._extendLog = function (info, log) {
    log.data = log.data || {};

    // Store the resolver info in each log
    if (info.resolver) {
        log.data.resolver = {
            name: info.resolver.getName(),
            source: info.resolver.getSource(),
            target: info.resolver.getTarget()
        };
    }

    // Store the canonical package and its meta in each log
    if (info.canonicalPkg) {
        log.data.canonicalPkg = info.canonicalPkg;
        log.data.pkgMeta = info.pkgMeta;
    }

    return log;
};

module.exports = PackageRepository;
