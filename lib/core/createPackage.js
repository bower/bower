var Q = require('Q');
var packages = require('./packages');

function createPackage(endpoint, options) {
    var split = endpoint.split('#'),
        range;

    // Extract the range from the endpoint
    endpoint = split[0];
    range = split[1];

    // Ensure options
    options = options || {};
    options.range = options.range || range;

    // TODO: analyze endpoint and create appropriate package
    return Q.fcall(new packages.UrlPackage(endpoint, options));
}

module.exports = createPackage;