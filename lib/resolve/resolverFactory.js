var Q = require('q');
var fs = require('fs');
var path = require('path');
var mout = require('mout');
var GitFsResolver = require('./resolvers/GitFsResolver');
var GitRemoteResolver = require('./resolvers/GitRemoteResolver');
var FsResolver = require('./resolvers/FsResolver');
var UrlResolver = require('./resolvers/UrlResolver');
var config = require('../config');
var createError = require('../util/createError');

function createResolver(decEndpoint, options) {
    var resOptions;
    var source = decEndpoint.source;
    var resolvedPath;

    options = options || {};
    options.config = options.config || config;

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

    return Q.nfcall(fs.stat, path.join(resolvedPath, '.git'))
    .then(function (stats) {
        if (stats.isDirectory()) {
            return { resolver: GitFsResolver, source: resolvedPath };
        }

        throw new Error('Not a Git repository');
    })
    // If not, check if source is a valid file/folder
    .fail(function () {
        return Q.nfcall(fs.stat, source)
        .then(function () {
            return { resolver: FsResolver, source: resolvedPath };
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

            return { resolver: GitRemoteResolver, source: source };
        }

        throw err;
    })
    // TODO: if not, check against the registry
    //       note that the registry should also have a persistent cache for offline usage
    // Finally throw a meaningful error
    .then(function (ConcreteResolver) {
        return new ConcreteResolver.resolver(source, resOptions);
    }, function () {
        throw new createError('Could not find appropriate resolver for source "' + source + '"', 'ENORESOLVER');
    });
}

module.exports = createResolver;
