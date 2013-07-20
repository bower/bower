var mout = require('mout');
var Logger = require('bower-logger');
var PackageRepository = require('../core/PackageRepository');
var cli = require('../util/cli');
var defaultConfig = require('../config');

function info(pkg, property, config) {
    var repository;
    var logger = new Logger();

    config = mout.object.deepFillIn(config || {}, defaultConfig);
    repository = new PackageRepository(config, logger);

    pkg = pkg.split('#');
    pkg = {
        name: pkg[0],
        version: pkg[1]
    };

    // If no version was specified, retrieve whole package info
    if (!pkg.version) {
        repository.versions(pkg.name)
        .then(function (versions) {
            logger.emit('end', {
                name: pkg.name,
                versions: versions
            });
        })
        .fail(function (error) {
            logger.emit('error', error);
        });
    // Otherwise fetch version and retrieve package meta
    } else {
        repository.fetch({
            source: pkg.name,
            target: pkg.version
        })
        .spread(function (canonicalDir, pkgMeta) {
            pkgMeta = mout.object.filter(pkgMeta, function (value, key) {
                return key.charAt(0) !== '_';
            });

            // Retrieve specific property
            if (property) {
                pkgMeta = mout.object.get(pkgMeta, property);
            }

            logger.emit('end', pkgMeta);
        })
        .fail(function (error) {
            logger.emit('error', error);
        });
    }

    return logger;
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
