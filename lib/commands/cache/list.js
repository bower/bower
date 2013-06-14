var EventEmitter = require('events').EventEmitter;
var mout = require('mout');
var PackageRepository = require('../../core/PackageRepository');
var Logger = require('../../core/Logger');
var cli = require('../../util/cli');
var defaultConfig = require('../../config');

function list(packages, options, config) {
    var repository;
    var emitter = new EventEmitter();
    var logger = new Logger();

    config = mout.object.deepMixIn(config || {}, defaultConfig);
    repository = new PackageRepository(config, logger);

    // If packages is an empty array, null them
    if (packages && !packages.length) {
        packages = null;
    }

    repository.list()
    .then(function (entries) {
        if (packages) {
            // Filter entries according to the specified packages
            entries = entries.filter(function (entry) {
                return !!mout.array.find(packages, function (pkg) {
                    return pkg === entry.pkgMeta.name;
                });
            });
        }

        emitter.emit('end', entries);
    }, function (error) {
        emitter.emit('error', error);
    });

    return logger.pipe(emitter);
}

// -------------------

list.line = function (argv) {
    var options = list.options(argv);
    return list(options.argv.remain.slice(2), options);
};

list.options = function (argv) {
    return cli.readOptions(argv);
};

list.completion = function () {
    // TODO:
};

module.exports = list;
