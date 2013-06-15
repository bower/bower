var EventEmitter = require('events').EventEmitter;
var fs = require('fs');
var mout = require('mout');
var Q = require('q');
var rimraf = require('rimraf');
var PackageRepository = require('../../core/PackageRepository');
var Logger = require('../../core/Logger');
var cli = require('../../util/cli');
var defaultConfig = require('../../config');

function clean(packages, options, config) {
    var promise;
    var emitter = new EventEmitter();
    var logger = new Logger();

    options = options || {};
    config = mout.object.deepMixIn(config || {}, defaultConfig);

    // If packages is an empty array, null them
    if (packages && !packages.length) {
        packages = null;
    // Otherwise parse them
    } else {
        packages = packages.map(function (pkg) {
            var split = pkg.split('#');
            return {
                name: split[0],
                version: split[1]
            };
        });
    }

    if (!options.completion) {
        promise = cleanPackages(config, logger, packages);
    } else {
        promise = Q.all([
            packages ? cleanPackages(config, logger, packages) : null,
            cleanCompletion(config, logger)
        ]);
    }

    promise
    .then(function (entries) {
        emitter.emit('end', entries);
    }, function (error) {
        emitter.emit('error', error);
    });

    return logger.pipe(emitter);
}

function cleanPackages(config, logger, packages) {
    var repository =  new PackageRepository(config, logger);

    return repository.list()
    .then(function (entries) {
        var promises;

        // Filter entries according to the specified packages
        if (packages) {
            entries = entries.filter(function (pkgMeta) {
                return !!mout.array.find(packages, function (pkg) {
                    // Check if names are different
                    if  (pkg.name !== pkgMeta.name) {
                        return false;
                    }

                    // If version was specified, check if they are different
                    if (pkg.version) {
                        return pkg.version === pkgMeta.version ||
                               pkg.version === pkgMeta.target;
                    }

                    return true;
                });
            });
        }

        promises = entries.map(function (entry) {
            return repository.eliminate(entry.pkgMeta);
        });

        return Q.all(promises)
        .then(function () {
            return entries;
        });
    });
}

function cleanCompletion(config, logger) {
    var dir = config.roaming.completion;

    return Q.nfcall(fs.stat, dir)
    .then(function () {
        return Q.nfcall(rimraf, dir)
        .then(function () {
            logger.info('deleted', 'Cleaned completion cache', {
                file: dir
            });
        });
    }, function (err) {
        if (err.code !== 'ENOENT') {
            throw err;
        }
    });
}

// -------------------

clean.line = function (argv) {
    var options = clean.options(argv);
    return clean(options.argv.remain.slice(2), options);
};

clean.options = function (argv) {
    return cli.readOptions({
        'completion': { type: Boolean, shorthand: 'c' }
    }, argv);
};

clean.completion = function () {
    // TODO:
};

module.exports = clean;
