var Q = require('q');
var path = require('path');
var fs = require('fs');
var mout = require('mout');

var semver = require('../../util/semver');
var createError = require('../../util/createError');
var readJson = require('../../util/readJson');
var removeIgnores = require('../../util/removeIgnores');

function pluginResolverFactory(pluginFactory, options) {
    options = options || {};

    if (typeof pluginFactory !== 'function') {
        throw new Error('Resolver has "' + typeof pluginFactory + '" type instead of "function" type.');
    }

    var plugin = pluginFactory(options);

    if (!plugin) {
        throw new Error('Resolver returned "' + typeof plugin +  '" type instead of factory instance.');
    }

    function PluginResolver(decEndpoint) {
        this._source = decEndpoint.source;
        this._target = decEndpoint.target || '*';
        this._name = decEndpoint.name;

        this._config = options.config;
        this._logger = options.logger;
    }

    PluginResolver.prototype.getSource = function () {
        return this._source;
    };

    PluginResolver.prototype.getTarget = function () {
        return this._target;
    };

    PluginResolver.prototype.getName = function() {
        if (!this._name && plugin.getName) {
            this._name = plugin.getName(this._source);
        }

        if (!this._name) {
            return path.basename(this._source);
        } else {
            return this._name;
        }
    };

    PluginResolver.prototype.getPkgMeta = function () {
        return this._pkgMeta;
    };

    // -----------------

    function maxSatisfyingVersion(versions, target) {
        var versionsArr, index;

        versionsArr = versions.map(function (obj) { return obj.version; });

        // Find a satisfying version, enabling strict match so that pre-releases
        // have lower priority over normal ones when target is *
        index = semver.maxSatisfyingIndex(versionsArr, target, true);

        if (index !== -1) {
            return versions[index];
        }
    }

    // Plugin Resolver is always considered potentially cacheable
    // The "resolve" method decides whether to use cached or fetch new version.
    PluginResolver.prototype.isCacheable = function() {
        return true;
    };

    // Not only it's always potentially cacheable, but also always potenially new.
    // The "resolve" handles logic of re-downloading target if needed.
    PluginResolver.prototype.hasNew = function (pkgMeta) {
        if (this.hasNewPromise) {
            return this.hasNewPromise;
        }

        this._pkgMeta = pkgMeta;

        return this.hasNewPromise = this.resolve().then(function (result) {
            return result !== undefined;
        });
    };

    PluginResolver.prototype.resolve = function () {
        if (this.resolvePromise) {
            return this.resolvePromise;
        }

        var that = this;

        var source = this._source;
        var target = this._target;

        return this.resolvePromise = Q.fcall(function() {
            // It means that we can accept ranges as targets
            if(that.constructor.isTargetable()) {
                that._release = target;

                if (semver.validRange(target)) {
                    return Q.fcall(plugin.releases.bind(plugin), source)
                    .then(function (result) {
                        if (!result.releases) {
                            throw createError('Resolver did not provide releases of package.');
                        }

                        var releases = result.releases;

                        var versions = releases.filter(function (target) {
                            return semver.clean(target.version);
                        });

                        var maxRelease = maxSatisfyingVersion(versions, target);

                        if (maxRelease) {
                            that._version = maxRelease.version;
                            that._release = target = maxRelease.target;
                        } else {
                            return Q.reject(new Error('The range ' + target + ' does not match any version of ' + that._source));
                        }
                    });
                }
            } else {
                if (semver.validRange(target) && target !== '*') {
                    return Q.reject(createError('Resolver does not accept version ranges (' + target + ')'));
                }
            }
        })
        .then(function () {

            // We pass old _resolution (if hasNew has been called before contents).
            // So plugin can decide wheter use cached version of contents new one.
            if (typeof plugin.contents !== 'function') {
                throw createError('Resolver does not implement the "contents" method.');
            }

            if (that._releases) {
                options.releases = that._releases;
            }

            if (that._pkgMeta) {
                options.cached = {
                    source: that._pkgMeta._source,
                    target: that._pkgMeta._target,
                    version: that._pkgMeta.version,
                    release: that._pkgMeta._release,
                    resolution: that._pkgMeta._resolution || {}
                };
            }

            return Q.fcall(plugin.contents.bind(plugin), source, target, options);
        })
        .then(function (result) {
            // Empty result means to re-use existing resolution
            if (!result) {
                return;
            } else {
                if (!result.contents) {
                    throw createError('Resolver did not provide path to extracted contents of package.');
                }

                that._tempDir = result.contents;

                return that._readJson(that._tempDir).then(function (meta) {
                    return that._applyPkgMeta(meta)
                    .then(that._savePkgMeta.bind(that, meta, result))
                    .then(function () {
                        return that._tempDir;
                    });
                });
            }
        });
    };

    PluginResolver.prototype._readJson = function (dir) {
        var that = this;

        return readJson(dir, {
            assume: { name: that.getName() }
        })
        .spread(function (json, deprecated) {
            if (deprecated) {
                that._logger.warn('deprecated', 'Package ' + that.getName() + ' is using the deprecated ' + deprecated);
            }

            return json;
        });
    };

    PluginResolver.prototype._applyPkgMeta = function (meta) {
        // Check if name defined in the json is different
        // If so and if the name was "guessed", assume the json name
        if (meta.name !== this._name) {
            this._name = meta.name;
        }

        // Handle ignore property, deleting all files from the temporary directory
        // If no ignores were specified, simply resolve
        if (!meta.ignore || !meta.ignore.length) {
            return Q.resolve(meta);
        }

        // Otherwise remove them from the temp dir
        return removeIgnores(this._tempDir, meta).then(function () {
            return meta;
        });
    };

    PluginResolver.prototype._savePkgMeta = function (meta, result) {
        var that = this;
        var contents;

        meta._source = that._source;
        meta._target = that._target;

        if (result.resolution) {
            meta._resolution = result.resolution;
        }

        if (that._release) {
            meta._release = that._release;
        }

        if (that._version) {
            meta.version = that._version;
        } else {
            delete meta.version;
        }

        ['main', 'ignore'].forEach(function (attr) {
            if (meta[attr]) return;

            that._logger.log(
                'warn', 'invalid-meta',
                (meta.name || 'component') + ' is missing "' + attr + '" entry in bower.json'
            );
        });

        // Stringify contents
        contents = JSON.stringify(meta, null, 2);

        return Q.nfcall(fs.writeFile, path.join(this._tempDir, '.bower.json'), contents)
        .then(function () {
            return that._pkgMeta = meta;
        });
    };

    // It is used only by "bower info". It returns all semver versions.
    PluginResolver.versions = function (source) {
        return Q.fcall(plugin.releases.bind(plugin), source).then(function (result) {
            if (!result.releases) {
                throw createError('Resolver did not provide releases of package.');
            }

            var releases = result.releases;

            var versions = releases.map(function (version) {
                return semver.clean(version.version);
            });

            versions = versions.filter(function (version) {
                return version;
            });

            versions.sort(function (a, b) {
                return semver.rcompare(a, b);
            });

            return versions;
        });
    };

    PluginResolver.isTargetable = function() {
        // If plugin doesn't define versions function, it's not targetable..
        return typeof plugin.releases === 'function';
    };

    PluginResolver.clearRuntimeCache = function () {
        plugin = pluginFactory(options);
    };

    PluginResolver.matches = function (source) {
        if (typeof plugin.matches !== 'function') {
            throw new Error('Resolver is missing "matches" method.');
        }

        return Q.fcall(plugin.matches.bind(plugin), source).then(function (result) {
            if (typeof result !== 'boolean') {
                throw new Error('Resolver\'s "matches" method should return a boolean');
            }

            return result;
        });
    };

    return PluginResolver;
}


module.exports = pluginResolverFactory;

