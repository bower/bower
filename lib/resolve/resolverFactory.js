var Q = require('q');
var GitFsResolver = require('./resolvers/GitFsResolver');
var GitRemoteResolver = require('./resolvers/GitRemoteResolver');
var FsResolver = require('./resolvers/FsResolver');
var UrlResolver = require('./resolvers/UrlResolver');

function createResolver(endpoint, options) {
    var split = endpoint.split('#'),
        source,
        target;

    // Extract the source and target from the endpoint
    source = split[0];
    target = split[1];

    // Ensure options
    options = options || {};
    options.target = options.target || target;

    // TODO: analyze source and create appropriate package
    return Q.fcall(new GitRemoteResolver(source, options));
}

module.exports = createResolver;