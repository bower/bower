var Q = require('Q');
var GitFsResolver = require('./resolvers/GitFsResolver');
var GitRemoteResolver = require('./resolvers/GitRemoteResolver');
var LocalResolver = require('./resolvers/LocalResolver');
var UrlResolver = require('./resolvers/UrlResolver');
var GitFsResolver = require('./resolvers/GitFsResolver');

function createResolver(endpoint, options) {
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