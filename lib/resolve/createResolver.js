var Q = require('Q');
var GitFsResolver = require('./resolvers/GitFsResolver');
var GitRemoteResolver = require('./resolvers/GitRemoteResolver');
var FsResolver = require('./resolvers/FsResolver');
var UrlResolver = require('./resolvers/UrlResolver');

function createResolver(endpoint, options) {
    var split = endpoint.split('#'),
        target;

    // Extract the range from the endpoint
    endpoint = split[0];
    target = split[1];

    // Ensure options
    options = options || {};
    options.target = options.target || target;

    // TODO: analyze endpoint and create appropriate package
    return Q.fcall(new GitRemoteResolver(endpoint, options));
}

module.exports = createResolver;