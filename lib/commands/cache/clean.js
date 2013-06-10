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
            cleanCompletion(config, logger),
            packages ? cleanPackages(config, logger, packages) : null
        ]);
    }

    promise
    .then(function () {
        emitter.emit('end');
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

        if (packages) {
            // Filter entries according to the specified packages
            entries = entries.filter(function (pkgMeta) {
                return !!mout.array.find(packages, function (pkg) {
                    // Check if names are different
                    if  (pkg.name !== pkgMeta.name) {
                        return false;
                    }

                    // If version was specified, check if they are different
                    if (pkg.version && pkg.version !== pkgMeta.version) {
                        return false;
                    }

                    return true;
                });
            });
        }

        promises = entries.map(function (pkgMeta) {
            logger.action('clean', pkgMeta._source + (pkgMeta._release ? '#' + pkgMeta._release : ''), pkgMeta);
            return repository.eliminate(pkgMeta);
        });

        return Q.all(promises);
    });
}

function cleanCompletion(config, logger) {
    var dir = config.roaming.completion;

    return Q.nfcall(fs.stat, dir)
    .then(function () {
        logger.action('delete', 'Erased completion cache', {
            file: dir
        });

        return Q.nfcall(rimraf, dir);
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
