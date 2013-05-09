var async = require('async');
var request = require('request');
var parseOptions = require('./util/parseOptions');
var createError = require('./util/createError');

function lookup(name, options, callback) {
    var url;
    var total;
    var current = 0;

    if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    // Parse and set default options
    options = parseOptions.forRead(options);

    // If no registry entries were passed, simply
    // error with package not found
    total = options.registry.length;
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
        var requestUrl = options.registry[current] + '/packages/' + encodeURIComponent(name);

        request.get(requestUrl, {
            proxy: options.proxy,
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

            callback(null, body.url);
        });
    }, function () {
        return !url && current++ < total;
    }, function (err) {
        // If some of the registry entries failed, error out
        if (err) {
            return callback(err);
        }

        // If at the end we still have no URL, create an appropriate error
        if (!url) {
            return callback(createError('Package "' + name + '" not found', 'ENOTFOUND'));
        }

        callback(null, url);
    });
}

module.exports = lookup;