var path = require('path');
var url = require('url');
var async = require('async');
var request = require('request');
var createError = require('./util/createError');
var Cache = require('./util/Cache');

function lookup(name, callback) {
    var data;
    var that = this;
    var registry = this._config.registry.search;
    var total = registry.length;
    var index = 0;

    // If no registry entries were passed, simply
    // error with package not found
    if (!total) {
        return callback();
    }

    // Lookup package in series in each registry
    // endpoint until we got the data
    async.doUntil(function (next) {
        var remote = url.parse(registry[index]);
        var lookupCache = that._lookupCache[remote.host];

        // If force flag is disabled we check the cache
        if (!that._config.force) {
            lookupCache.get(name, function (err, value) {
                data = value;

                // Don't proceed with making a request if we got an error,
                // a value from the cache or if the offline flag is enabled
                if (err || data || that._config.offline) {
                    return next(err);
                }

                doRequest(name, index, that._config, function (err, entry) {
                    if (err || !entry) {
                        return next(err);
                    }

                    data = entry;

                    // Store in cache
                    lookupCache.set(name, entry, getMaxAge(entry), next);
                });
            });
        // Otherwise, we totally bypass the cache and
        // make only the request
        } else {
            doRequest(name, index, that._config, function (err, entry) {
                if (err || !entry) {
                    return next(err);
                }

                data = entry;

                // Store in cache
                lookupCache.set(name, entry, getMaxAge(entry), next);
            });
        }
    }, function () {
        // Until the data is unknown or there's still registries to test
        return !!data || index++ < total;
    }, function (err) {
        // If some of the registry entries failed, error out
        if (err) {
            return callback(err);
        }

        callback(null, data);
    });
}

function doRequest(name, index, config, callback) {
    var requestUrl = config.registry.search[index] + '/packages/' + encodeURIComponent(name);
    var remote = url.parse(requestUrl);
    var headers = {};

    if (config.userAgent) {
        headers['User-Agent'] = config.userAgent;
    }

    request.get(requestUrl, {
        proxy: remote.protocol === 'https:' ? config.httpsProxy : config.proxy,
        ca: config.ca.search[index],
        strictSSL: config.strictSsl,
        timeout: config.timeout,
        json: true
    }, function (err, response, body) {
        // If there was an internal error (e.g. timeout)
        if (err) {
            return callback(createError('Request to ' + requestUrl + ' failed: ' + err.message, err.code));
        }

        // If not found, try next
        if (response.statusCode === 404) {
            return callback();
        }

        // Abort if there was an error (range different than 2xx)
        if (response.statusCode < 200 || response.statusCode > 299) {
            return callback(createError('Request to ' + requestUrl + ' failed with ' + response.statusCode, 'EINVRES'));
        }

        // Validate response body, since we are expecting a JSON object
        // If the server returns an invalid JSON, it's still a string
        if (typeof body !== 'object') {
            return callback(createError('Response of request to ' + requestUrl + ' is not a valid json', 'EINVRES'));
        }

        callback(null, {
            type: 'alias',
            url: body.url
        });
    });
}

function getMaxAge(entry) {
    // If type is alias, make it 5 days
    if (entry.type === 'alias') {
        return 5 * 24 * 60 * 60 * 1000;
    }

    // Otherwise make it 5 minutes
    return 5 * 60 * 60 * 1000;
}

function initCache() {
    this._lookupCache = this._cache.lookup || {};

    // Generate a cache instance for each registry endpoint
    this._config.registry.search.forEach(function (registry) {
        var cacheDir;
        var host = url.parse(registry).host;

        // Skip if there's a cache for the same host
        if (this._lookupCache[host]) {
            return;
        }

        if (this._config.cache) {
            cacheDir = path.join(this._config.cache, encodeURIComponent(host), 'lookup');
        }

        this._lookupCache[host] = new Cache(cacheDir, {
            max: 250,
            // If offline flag is passed, we use stale entries from the cache
            useStale: this._config.offline
        });
    }, this);
}

function clearCache(name, callback) {
    var lookupCache = this._lookupCache;
    var remotes = Object.keys(lookupCache);

    if (typeof name === 'function') {
        callback = name;
        name = null;
    }

    if (name) {
        async.forEach(remotes, function (remote, next) {
            lookupCache[remote].del(name, next);
        }, callback);
    } else {
        async.forEach(remotes, function (remote, next) {
            lookupCache[remote].clear(next);
        }, callback);
    }
}

function clearRuntimeCache() {
    var remote;

    for (remote in this._lookupCache) {
        this._lookupCache[remote].reset();
    }
}

lookup.initCache = initCache;
lookup.clearCache = clearCache;
lookup.clearRuntimeCache = clearRuntimeCache;

module.exports = lookup;
