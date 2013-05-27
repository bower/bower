var Q = require('q');
var fs = require('fs');
var path = require('path');
var mout = require('mout');
var resolvers = require('./resolvers');
var defaultConfig = require('../config');
var createError = require('../util/createError');

function createResolver(decEndpoint, registryClient, config) {
    var resOptions;
    var source = decEndpoint.source;
    var resolvedPath;

    config = config || defaultConfig;

    // Setup resolver options
    resOptions = {
        target: decEndpoint.target,
        name: decEndpoint.name,
        config: config
    };

    // Git case: git git+ssh, git+http, git+https
    //           .git at the end (probably ssh shorthand)
    if (/^git(\+(ssh|https?))?:\/\//i.test(source) || /\.git\/?$/i.test(source)) {
        source = source.replace(/^git\+/, '');
        return Q.fcall(function () {
            return new resolvers.GitRemote(source, resOptions);
        });
    }

    // URL case
    if (/^https?:\/\//i.exec(source)) {
        return Q.fcall(function () {
            return new resolvers.Url(source, resOptions);
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
            return function () {
                return Q.resolve(new resolvers.GitFs(resolvedPath, resOptions));
            };
        }

        throw new Error('Not a Git repository');
    })
    // If not, check if source is a valid file/folder
    .fail(function () {
        return Q.nfcall(fs.stat, source)
        .then(function () {
            return function () {
                return Q.resolve(new resolvers.Fs(resolvedPath, resOptions));
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
                return Q.resolve(new resolvers.GitRemote(source, resOptions));
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
                decEndpoint.registryName = source;
                // TODO: Handle entry.type.. for now it's only 'alias'
                //       When we got published packages, this needs to be adjusted
                return new resolvers.GitRemote(entry.url, resOptions);
            });
        };
    })
    // If we got the function, simply call and return
    .then(function (func) {
        return func();
    // Finally throw a meaningful error
    }, function () {
        throw new createError('Could not find appropriate resolver for source "' + source + '"', 'ENORESOLVER');
    });
}

module.exports = createResolver;
