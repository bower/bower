var Q = require('q');
var fs = require('fs');
var path = require('path');
var mout = require('mout');
var GitFsResolver = require('./resolvers/GitFsResolver');
var GitRemoteResolver = require('./resolvers/GitRemoteResolver');
var FsResolver = require('./resolvers/FsResolver');
var UrlResolver = require('./resolvers/UrlResolver');
var defaultConfig = require('../config');
var createError = require('../util/createError');

function createResolver(decEndpoint, options) {
    var resOptions;
    var source = decEndpoint.source;
    var resolvedPath;

    options = options || {};
    options.config = options.config || defaultConfig;

    // Setup resolver options
    resOptions = {
        target: decEndpoint.target,
        name: decEndpoint.name,
        config: options.config
    };

    // Git case: git git+ssh, git+http, git+https
    //           .git at the end (probably ssh shorthand)
    if (/^git(\+(ssh|https?))?:\/\//i.test(source) || /\.git\/?$/i.test(source)) {
        source = source.replace(/^git\+/, '');
        return Q.fcall(function () {
            return new GitRemoteResolver(source, resOptions);
        });
    }

    // URL case
    if (/^https?:\/\//i.exec(source)) {
        return Q.fcall(function () {
            return new UrlResolver(source, resOptions);
        });
    }

    // Check if source is a git repository
    resolvedPath = path.resolve(options.config.cwd, source);

    // Below we try a series of asyc tests to guess the type of resolver to use
    // If a step was unable to guess the resolver, it throws an error
    // If a step was able to guess the resolver, it resolves with a function
    // That function returns a promise that will resolve with the concrete type,
    // ready to be used
    return Q.nfcall(fs.stat, path.join(resolvedPath, '.git'))
    .then(function (stats) {
        if (stats.isDirectory()) {
            return function () {
                return Q.resolve(new GitFsResolver(resolvedPath, resOptions));
            };
        }

        throw new Error('Not a Git repository');
    })
    // If not, check if source is a valid file/folder
    .fail(function () {
        return Q.nfcall(fs.stat, source)
        .then(function () {
            return function () {
                return Q.resolve(new FsResolver(resolvedPath, resOptions));
            };
        });
    })
    // If not, check if is a shorthand and expand it
    .fail(function (err) {
        var parts = source.split('/');

        if (parts.length === 2) {
            source = mout.string.interpolate(options.config.shorthandResolver, {
                shorthand: source,
                owner: parts[0],
                package: parts[1]
            });

            return function () {
                return Q.resolve(new GitRemoteResolver(source, resOptions));
            };
        }

        throw err;
    })
    // As last resort, we try the registry
    .fail(function (err) {
        var registry = options.registryClient;

        if (!registry) {
            throw err;
        }

        return function () {
            return Q.nfcall(registry.lookup.bind(registry), source, options)
            .then(function (entry) {
                decEndpoint.registryName = source;
                // TODO: Handle entry.type.. for now it's only 'alias'
                //       When we got published packages, this needs to be adjusted
                return new GitRemoteResolver(entry.url, resOptions);
            });
        };
    })
    // If we got the func, simply call and return
    .then(function (func) {
        return func();
    // Finally throw a meaningful error
    }, function () {
        throw new createError('Could not find appropriate resolver for source "' + source + '"', 'ENORESOLVER');
    });
}

module.exports = createResolver;
