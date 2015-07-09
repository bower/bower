var Q = require('q');
var fs = require('graceful-fs');
var path = require('path');
var mout = require('mout');
var resolvers = require('./resolvers');
var createError = require('../util/createError');

var pluginResolver = require('./resolvers/PluginResolver');

function createInstance(decEndpoint, config, logger, registryClient) {
    return getConstructor(decEndpoint.source, config, logger, registryClient)
    .spread(function (ConcreteResolver, source, fromRegistry) {
        var decEndpointCopy = mout.object.pick(decEndpoint, ['name', 'target']);

        decEndpointCopy.source = source;

        // Signal if it was fetched from the registry
        if (fromRegistry) {
            decEndpoint.registry = true;
            // If no name was specified, assume the name from the registry
            if (!decEndpointCopy.name) {
                decEndpointCopy.name = decEndpoint.name = decEndpoint.source;
            }
        }

        return new ConcreteResolver(decEndpointCopy, config, logger);
    });
}

function getConstructor(source, config, logger, registryClient) {
    // Below we try a series of async tests to guess the type of resolver to use
    // If a step was unable to guess the resolver, it returns undefined
    // If a step was able to guess the resolver, it resolves with construcotor of resolver

    var promise = Q.resolve();

    var addResolver = function (getConstructor) {
        promise = promise.then(function (result) {
            if (result === undefined) {
                return getConstructor(source, config, logger);
            } else {
                return result;
            }
        });
    };

    // Plugin resolvers. It requires each resolver defined in config.resolvers
    // and calls its match function that returns instance of resolver or undefined
    //
    // Instance of resolver is then
    addResolver(function (source, config, logger) {
        var selectedResolver;

        var resolverNames = config.resolvers || [];

        var resolverOptions = { config: config, logger: logger };

        var resolverPromises = resolverNames.map(function (resolverName) {
            var resolver = resolvers[resolverName] || pluginResolver(resolverName, resolverOptions);

            return function () {
                if (selectedResolver === undefined) {
                    return Q.when(resolver.matches(source)).then(function (result) {
                        if (result) {
                            return selectedResolver = resolver;
                        }
                    });
                } else {
                    return selectedResolver;
                }
            };
        });

        return resolverPromises.reduce(Q.when, new Q(undefined)).then(function (resolver) {
            if (resolver) {
                return [resolver, source];
            }
        });
    });

    // Git case: git git+ssh, git+http, git+https
    //           .git at the end (probably ssh shorthand)
    //           git@ at the start
    addResolver(function(source, config) {
        if (/^git(\+(ssh|https?))?:\/\//i.test(source) || /\.git\/?$/i.test(source) || /^git@/i.test(source)) {
            source = source.replace(/^git\+/, '');

            // If it's a GitHub repository, return the specialized resolver
            if (resolvers.GitHub.getOrgRepoPair(source)) {
                return [resolvers.GitHub, source];
            }

            return [resolvers.GitRemote, source];
        }
    });

    // SVN case: svn, svn+ssh, svn+http, svn+https, svn+file
    addResolver(function (source, config) {
        if (/^svn(\+(ssh|https?|file))?:\/\//i.test(source)) {
            return [resolvers.Svn, source];
        }
    });

    // URL case
    addResolver(function (source, config) {
        if (/^https?:\/\//i.exec(source)) {
            return [resolvers.Url, source];
        }
    });


    // If source is ./ or ../ or an absolute path

    addResolver(function (source, config) {
        var absolutePath = path.resolve(config.cwd, source);

        if (/^\.\.?[\/\\]/.test(source) || /^~\//.test(source) ||
            path.normalize(source).replace(/[\/\\]+$/, '') === absolutePath
        ) {
            return Q.nfcall(fs.stat, path.join(absolutePath, '.git'))
            .then(function (stats) {
                if (stats.isDirectory()) {
                    return Q.resolve([resolvers.GitFs, absolutePath]);
                }

                throw new Error('Not a Git repository');
            })
            // If not, check if source is a valid Subversion repository
            .fail(function () {
                return Q.nfcall(fs.stat, path.join(absolutePath, '.svn'))
                .then(function (stats) {
                    if (stats.isDirectory()) {
                        return Q.resolve([resolvers.Svn, absolutePath]);
                    }

                    throw new Error('Not a Subversion repository');
                });
            })
            // If not, check if source is a valid file/folder
            .fail(function () {
                return Q.nfcall(fs.stat, absolutePath)
                .then(function () {
                    return Q.resolve([resolvers.Fs, absolutePath]);
                });
            });
        }
    });

    // Check if is a shorthand and expand it
    addResolver(function (source, config) {
        // Skip ssh and/or URL with auth
        if (/[:@]/.test(source)) {
            return;
        }

        // Ensure exactly only one "/"
        var parts = source.split('/');
        if (parts.length === 2) {
            source = mout.string.interpolate(config.shorthandResolver, {
                shorthand: source,
                owner: parts[0],
                package: parts[1]
            });

            return getConstructor(source, config, logger, registryClient);
        }
    });

    // As last resort, we try the registry
    addResolver(function (source, config) {
        if (!registryClient) {
            return;
        }

        return Q.nfcall(registryClient.lookup.bind(registryClient), source)
        .then(function (entry) {
            if (!entry) {
                throw createError('Package ' + source + ' not found', 'ENOTFOUND');
            }

            // TODO: Handle entry.type.. for now it's only 'alias'
            //       When we got published packages, this needs to be adjusted
            source = entry.url;

            return getConstructor(source, config, logger, registryClient)
            .spread(function (ConcreteResolver, source) {
                return [ConcreteResolver, source, true];
            });
        });
    });

    addResolver(function () {
        throw createError('Could not find appropriate resolver for ' + source, 'ENORESOLVER');
    });

    return promise;
}

function clearRuntimeCache() {
    mout.object.values(resolvers).forEach(function (ConcreteResolver) {
        ConcreteResolver.clearRuntimeCache();
    });
}

module.exports = createInstance;
module.exports.getConstructor = getConstructor;
module.exports.clearRuntimeCache = clearRuntimeCache;
