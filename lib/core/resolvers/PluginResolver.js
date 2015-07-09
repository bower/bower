var util = require('util');
var mout = require('mout');
var Q = require('q');
var Resolver = require('./Resolver');
var LRU = require('lru-cache');
var semver = require('../../util/semver');
var createError = require('../../util/createError');
var path = require('path');


function Adapter(pluginName, options) {
    var pluginFactory = require(pluginName);

    var plugin = pluginFactory(options);

    function PluginResolver(decEndpoint) {
        this._source = decEndpoint.source;
        this._target = decEndpoint.target || '*';
        this._name = decEndpoint.name;

        this._config = options.config;
        this._logger = options.logger;
    }

    util.inherits(PluginResolver, Resolver);
    mout.object.mixIn(PluginResolver, Resolver);

    PluginResolver.getName = function() {
        if (!this._name && plugin.getName) {
            this._name = plugin.getName(this._source);
        }

        if (!this._name) {
            this._name = path.basename(this._source);
        }

        if (this._name) {
            return this._name;
        }
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
    // The "resolve" handles logic of re-downloading target if new one is available.
    PluginResolver.prototype.hasNew = function (canonicalDir, pkgMeta) {
        if (this.hasNewPromise) {
            return this.hasNewPromise;
        }

        this._canonicalDir = canonicalDir;
        this._oldPkgMeta = pkgMeta;
        this._resolution = pkgMeta._resolution;

        return this.hasNewPromise = this.resolve().then(function (result) {
            return result !== undefined;
        });
    };

    PluginResolver.prototype.resolve = function () {
        if (this.resolvePromise) {
            return this.resolvePromise;
        }

        // If already working, error out
        if (this._working) {
            return Q.reject(createError('Already working', 'EWORKING'));
        }

        this._working = true;

        var that = this;

        var target = this._target;

        return this.resolvePromise = Q.fcall(function() {
            // It means that we can accept ranges as targets
            if(that.constructor.isTargetable()) {
                if (semver.validRange(target)) {
                    return plugin.versions(that._source)
                    .then(function (versions) {
                        var maxVersion = maxSatisfyingVersion(versions, target);

                        if (maxVersion) {
                            return maxVersion.target;
                        } else {
                            return Q.reject(new Error('The range ' + target + ' does not match any version of ' + that._source));
                        }
                    });
                }  else {
                    return target;
                }
            } else {
                if (semver.validRange(target) && target !== '*') {
                    return Q.reject(createError('Resolver ' + pluginName + ' does not accept version ranges (' + target + ')'));
                }

                return target;
            }
        })
        .then(function (target) {
            // We pass old _resolution (if hasNew has been called before fetch).
            // So plugin can decide wheter use cached version of fetch new one.
            return plugin.fetch(that._source, target, that._resolution);
        })
        .then(function (result) {
            // Empty result means to re-use existing resolution
            if (!result) {
                return;
            } else {
                if (!result.contents) {
                    throw createError('Resolver did not provide path to extracted package contents.');
                }

                that._tempDir = result.contents;

                return that._readJson().then(function (meta) {
                    return that._applyPkgMeta(meta)
                    .then(that._savePkgMeta.bind(that, meta, result.resolution))
                    .then(function () {
                        return that._tempDir;
                    });
                });
            }
        })
        .catch(function(e) {
            e.code = pluginName;
            throw e;
        })
        .fin(function () {
            that._working = false;
        });
    };

    PluginResolver.prototype._savePkgMeta = function (meta, resolution) {
        if (this.constructor.isTargetable()) {
            meta._resolution = resolution;
            meta._release = resolution.target;
        }

        return Resolver.prototype._savePkgMeta.call(this, meta);
    };

    PluginResolver.versions = function (source) {
        return plugin.versions(source).then(function (versions) {
            versions = versions.filter(function (version) {
                return versions.version !== undefined;
            });

            versions = versions.map(function (version) {
                return semver.clean(versions.version);
            });

            versions.sort(function (a, b) {
                return semver.rcompare(a.version, b.version);
            });

            return versions;
        });
    };

    PluginResolver.isTargetable = function() {
        // If plugin doesn't define versions function, it's not targetable..
        return typeof plugin.versions === 'function';
    };

    PluginResolver.clearRuntimeCache = function () {
        plugin = pluginFactory(options);
        PluginResolver._cache.versions.reset();
    };

    PluginResolver._cache = {
        versions: new LRU({ max: 50, maxAge: 5 * 60 * 1000 })
    };

    PluginResolver.matches = function (source) {
        return plugin.matches(source);
    };

    return PluginResolver;
}


module.exports = Adapter;
