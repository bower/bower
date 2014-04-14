var mout = require('mout');
var Q = require('q');
var endpointParser = require('bower-endpoint-parser');
var PackageRepository = require('../core/PackageRepository');
var cli = require('../util/cli');
var Tracker = require('../util/analytics').Tracker;
var defaultConfig = require('../config');

function info(logger, endpoint, property, config) {
    var repository;
    var decEndpoint;
    var tracker;

    config = mout.object.deepFillIn(config || {}, defaultConfig);
    repository = new PackageRepository(config, logger);
    tracker = new Tracker(config);

    decEndpoint = endpointParser.decompose(endpoint);
    tracker.trackDecomposedEndpoints('info', [decEndpoint]);

    return Q.all([
        getPkgMeta(repository, decEndpoint, property),
        decEndpoint.target === '*' && !property ? repository.versions(decEndpoint.source) : null
    ])
    .spread(function (pkgMeta, versions) {
        if (versions) {
            return {
                name: decEndpoint.source,
                versions: versions,
                latest: pkgMeta
            };
        }

        return pkgMeta;
    });
}

function getPkgMeta(repository, decEndpoint, property) {
    return repository.fetch(decEndpoint)
    .spread(function (canonicalDir, pkgMeta) {
        pkgMeta = mout.object.filter(pkgMeta, function (value, key) {
            return key.charAt(0) !== '_';
        });

        // Retrieve specific property
        if (property) {
            pkgMeta = mout.object.get(pkgMeta, property);
        }

        return pkgMeta;
    });
}

// -------------------

info.line = function (logger, argv) {
    var options = cli.readOptions(argv);
    var pkg = options.argv.remain[1];
    var property = options.argv.remain[2];

    if (!pkg) {
        return new Q(null);
    }

    return info(pkg, property);
};

info.completion = function () {
    // TODO:
};

module.exports = info;
