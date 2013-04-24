var Q                 = require('q');
var fs                = require('fs');
var path              = require('path');
var request           = require('request');
var GitFsResolver     = require('./resolvers/GitFsResolver');
var GitRemoteResolver = require('./resolvers/GitRemoteResolver');
var FsResolver        = require('./resolvers/FsResolver');
var UrlResolver       = require('./resolvers/UrlResolver');

/*

## TODO:

- fabrication cache: based on the source, store the resolver type
- use `registry.search` configuration in the registry search
- use `shorthandResolver` and assume remote git when "\w+\/\w+" is the source

*/

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

    // Test source type.
    // Valid types are: local folder, URL, local git, remote git and published
    // package

    // if it's a remote git
    if (/^git(\+(ssh|https?))?:\/\//i.exec(source)) {
        return Q.resolve(new GitRemoteResolver(source, options));
    }

    // if it's an URL
    if (/^https?:\/\//i.exec(source)) {
        return Q.resolve(new UrlResolver(source, options));
    }

    // if it's a local git
    return Q.nfcall(fs.stat, path.resolve(source + '/.git'))
        .then(function (stats) {
            if (stats.isDirectory()) {
                return new GitFsResolver(source, options);
            } else {
                throw new Error('.git is not a folder');
            }
        })
        .fail(function () {
            // if it's a local file/folder
            return Q.nfcall(fs.stat, source)
                .then(function () {
                    return new FsResolver(source, options);
                })
                .fail(function () {
                    return Q.nfcall(request, 'https://bower.herokuapp.com/packages/' + source)
                        .spread(function (res, body) {
                            if (res.statusCode === 404) {
                                throw new Error('Not a package alias');
                            }

                            return createResolver(JSON.parse(body).url, options);
                        })
                        .fail(function (err) {
                            throw new Error('Unknown source type');
                            //return new PublishedResolver(source, options);
                        })
                    ;
                })
            ;
        }
    );
}

module.exports = createResolver;