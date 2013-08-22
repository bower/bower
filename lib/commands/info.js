var mout = require('mout');
var Q = require('q');
var Logger = require('bower-logger');
var endpointParser = require('bower-endpoint-parser');
var PackageRepository = require('../core/PackageRepository');
var cli = require('../util/cli');
var defaultConfig = require('../config');

function info(endpoint, property, config) {
    var repository;
    var decEndpoint;
    var logger = new Logger();

    config = mout.object.deepFillIn(config || {}, defaultConfig);
    repository = new PackageRepository(config, logger);

    decEndpoint = endpointParser.decompose(endpoint);

    Q.all([
        getPkgMeta(repository, decEndpoint, property),
        decEndpoint.target === '*' && !property ? repository.versions(decEndpoint.source) : null
    ])
    .spread(function (pkgMeta, versions) {
        if (versions) {
            return logger.emit('end', {
                name: decEndpoint.source,
                versions: versions,
                latest: pkgMeta
            });
        }

        logger.emit('end', pkgMeta);
    })
    .fail(function (error) {
        logger.emit('error', error);
    });

    return logger;
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

info.line = function (argv) {
    var options = info.options(argv);
    var pkg = options.argv.remain[1];
    var property = options.argv.remain[2];

    if (!pkg) {
        return null;
    }

    return info(pkg, property);
};

info.options = function (argv) {
    return cli.readOptions(argv);
};

info.completion = function () {
    // TODO:
};

module.exports = info;
