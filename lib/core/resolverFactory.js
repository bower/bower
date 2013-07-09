var Q = require('q');
var fs = require('graceful-fs');
var path = require('path');
var mout = require('mout');
var url = require('url');
var resolvers = require('./resolvers');
var createError = require('../util/createError');

function getConstructor(source, config, registryClient) {
    var resolvedPath;
    var remote;

    // Git case: git git+ssh, git+http, git+https
    //           .git at the end (probably ssh shorthand)
    if (/^git(\+(ssh|https?))?:\/\//i.test(source) || /\.git\/?$/i.test(source)) {
        source = source.replace(/^git\+/, '');
        return Q.fcall(function () {
            remote = url.parse(source);

            // If it's a GitHub repository, return the specialized resolver
            if (remote.hostname.toLowerCase() === 'github.com') {
                return [resolvers.GitHub, source];
            }

            return [resolvers.GitRemote, source];
        });
    }

    // URL case
    if (/^https?:\/\//i.exec(source)) {
        return Q.fcall(function () {
            return [resolvers.Url, source];
        });
    }

    // Check if source is a git repository
    resolvedPath = path.resolve(config.cwd, source);

    // Below we try a series of asyc tests to guess the type of resolver to use
    // If a step was unable to guess the resolver, it throws an error
    // If a step was able to guess the resolver, it resolves with a function
    // That function returns a promise that will resolve with the concrete type,
    // ready to be used
    return Q.nfcall(fs.stat, path.join(resolvedPath, '.git'))
    .then(function (stats) {
        if (stats.isDirectory()) {
            source = resolvedPath;
            return function () {
                return Q.resolve([resolvers.GitFs, source]);
            };
        }

        throw new Error('Not a Git repository');
    })
    // If not, check if source is a valid file/folder
    .fail(function () {
        return Q.nfcall(fs.stat, resolvedPath)
        .then(function () {
            source = resolvedPath;
            return function () {
                return Q.resolve([resolvers.Fs, source]);
            };
        });
    })
    // If not, check if is a shorthand and expand it
    .fail(function (err) {
        var parts = source.split('/');

        if (parts.length === 2) {
            source = mout.string.interpolate(config.shorthandResolver, {
                shorthand: source,
                owner: parts[0],
                package: parts[1]
            });

            return function () {
                return Q.resolve([resolvers.GitRemote, source]);
            };
        }

        throw err;
    })
    // As last resort, we try the registry
    .fail(function (err) {
        if (!registryClient) {
            throw err;
        }

        return function () {
            return Q.nfcall(registryClient.lookup.bind(registryClient), source)
            .then(function (entry) {
                if (!entry) {
                    throw createError('Package ' + source + ' not found', 'ENOTFOUND');
                }

                // TODO: Handle entry.type.. for now it's only 'alias'
                //       When we got published packages, this needs to be adjusted
                source = entry.url;

                return getConstructor(source, config, registryClient)
                .spread(function (ConcreteResolver, source) {
                    return [ConcreteResolver, source, true];
                });
            });
        };
    })
    // If we got the function, simply call and return
    .then(function (func) {
        return func();
    // Finally throw a meaningful error
    }, function () {
        throw new createError('Could not find appropriate resolver for ' + source, 'ENORESOLVER');
    });
}

function createInstance(decEndpoint, config, logger, registryClient) {
    return getConstructor(decEndpoint.source, config, registryClient)
    .spread(function (ConcreteResolver, source, fromRegistry) {
        var decEndpointCopy = mout.object.pick(decEndpoint, ['name', 'target']);

        decEndpointCopy.source = source;

        // Signal if it was fetched from the registry
        if (fromRegistry) {
            decEndpoint.registry = true;
            // If no name was specified, assume the name from the registry
            if (!decEndpointCopy.name) {
                decEndpointCopy.name = decEndpoint.source;
                decEndpoint.name = decEndpoint.source;
            }
        }

        return new ConcreteResolver(decEndpointCopy, config, logger);
    });
}

function clearRuntimeCache() {
    mout.object.values(resolvers).forEach(function (ConcreteResolver) {
        ConcreteResolver.clearRuntimeCache();
    });
}

module.exports = createInstance;
module.exports.getConstructor = getConstructor;
module.exports.clearRuntimeCache = clearRuntimeCache;
