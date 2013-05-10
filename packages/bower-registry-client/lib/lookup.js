var async = require('async');
var request = require('request');
var url = require('url');
var createError = require('./util/createError');

function lookup(name, force, callback) {
    var packageUrl;
    var total;
    var index = 0;
    var options = this._options;
    var registry = options.registry.search;

    if (typeof force === 'function') {
        callback = force;
        force = false;
    }

    // If no registry entries were passed, simply
    // error with package not found
    total = registry.length;
    if (!total) {
        return callback(createError('Package "' + name + '" not found', 'ENOTFOUND'));
    }

    // TODO: Add cache layer to avoid querying the registry always
    //       The cache should be persistent and by-passable with a skipCache option
    //       Beware that cache should take the configured registries in account
    //       Ideally each registry should have an independent cache, so that each step
    //       below would query the cache individually

    // Lookup package in series until we got the URL
    async.doUntil(function (next) {
        var requestUrl = registry[index] + '/packages/' + encodeURIComponent(name);
        var remote = url.parse(requestUrl);
        var headers = {};

        if (options.userAgent) {
            headers['User-Agent'] = options.userAgent;
        }

        request.get(requestUrl, {
            proxy: remote.protocol === 'https:' ? options.httpsProxy : options.proxy,
            ca: options.ca.search[index],
            strictSSL: options.strictSsl,
            timeout: options.timeout,
            json: true
        }, function (err, response, body) {
            // If there was an internal error (e.g. timeout)
            if (err) {
                return next(createError('Request to "' + requestUrl + '" failed: ' + err.message, err.code));
            }

            // If not found, try next
            if (response.statusCode === 404) {
                return next();
            }

            // Abort if there was an error (range different than 2xx)
            if (response.statusCode < 200 || response.statusCode > 299) {
                return next(createError('Request to "' + requestUrl + '" failed with ' + response.statusCode, 'EINVRES'));
            }

            // Validate response body, since we are expecting a JSON object
            // If the server returns an invalid JSON, it's still a string
            if (typeof body !== 'object') {
                return next(createError('Response of request to "' + requestUrl + '" is not a valid json', 'EINVRES'));
            }

            packageUrl = body.url;
            next();
        });
    }, function () {
        // Until the url is unknown or there's still registries to tests
        return !!packageUrl || index++ < total;
    }, function (err) {
        // If some of the registry entries failed, error out
        if (err) {
            return callback(err);
        }

        // If at the end we still have no URL, create an appropriate error
        if (!packageUrl) {
            return callback(createError('Package "' + name + '" not found', 'ENOTFOUND'));
        }

        callback(null, packageUrl);
    });
}

function clearCache(name) {
    // TODO
}

module.exports = lookup;
module.exports.clearCache = clearCache;