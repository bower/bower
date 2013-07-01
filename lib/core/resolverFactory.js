var Q = require('q');
var fs = require('graceful-fs');
var path = require('path');
var mout = require('mout');
var resolvers = require('./resolvers');
var createError = require('../util/createError');

function getConstructor(source, config, registryClient) {
    var resolvedPath;
    var resolvedSource = source;

    // Git case: git git+ssh, git+http, git+https
    //           .git at the end (probably ssh shorthand)
    if (/^git(\+(ssh|https?))?:\/\//i.test(source) || /\.git\/?$/i.test(source)) {
        resolvedSource = source.replace(/^git\+/, '');
        return Q.fcall(function () {
            return [resolvers.GitRemote, resolvedSource];
        });
    }

    // URL case
    if (/^https?:\/\//i.exec(source)) {
        return Q.fcall(function () {
            return [resolvers.Url, resolvedSource];
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
            resolvedSource = resolvedPath;
            return function () {
                return Q.resolve([resolvers.GitFs, resolvedSource]);
            };
        }

        throw new Error('Not a Git repository');
    })
    // If not, check if source is a valid file/folder
    .fail(function () {
        return Q.nfcall(fs.stat, resolvedPath)
        .then(function () {
            resolvedSource = resolvedPath;
            return function () {
                return Q.resolve([resolvers.Fs, resolvedSource]);
            };
        });
    })
    // If not, check if is a shorthand and expand it
    .fail(function (err) {
        var parts = source.split('/');

        if (parts.length === 2) {
            resolvedSource = mout.string.interpolate(config.shorthandResolver, {
                shorthand: source,
                owner: parts[0],
                package: parts[1]
            });

            return function () {
                return Q.resolve([resolvers.GitRemote, resolvedSource]);
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
                resolvedSource = entry.url;

                return [resolvers.GitRemote, resolvedSource, true];
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

function createResolver(decEndpoint, config, logger, registryClient) {
    return getConstructor(decEndpoint.source, config, registryClient)
    .spread(function (ConcreteResolver, source, fromRegistry) {
        var resolverDecEndpoint = mout.object.pick(decEndpoint, ['name', 'target']);

        resolverDecEndpoint.source = source;

        // Signal if it was fetched from the registry
        if (fromRegistry) {
            decEndpoint.registry = true;
        }

        return new ConcreteResolver(resolverDecEndpoint, config, logger);
    });
}

createResolver.getConstructor = getConstructor;

module.exports = createResolver;
