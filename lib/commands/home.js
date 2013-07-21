var path = require('path');
var mout = require('mout');
var Logger = require('bower-logger');
var PackageRepository = require('../core/PackageRepository');
var open = require('open');
var findup = require('findup');
var cli = require('../util/cli');
var createError = require('../util/createError');
var defaultConfig = require('../config');

function home(name, config) {
    var packageRepository;
    var logger = new Logger();

    config = mout.object.deepFillIn(config || {}, defaultConfig);
    config.cache = config.storage.registry;

    if (!name) {
        findup(config.cwd, 'bower.json', function (err, dir) {
            if (err) {
                return logger.emit('error', createError('You are not inside a package. Please specify a package name.', 'ENOENT'));
            }

            var pkgMeta = require(path.join(dir, 'bower.json'));

            openUrl(logger, pkgMeta);
        });

        return logger;
    }

    packageRepository = new PackageRepository(config, logger);

    // Fetch the package
    packageRepository.fetch({ name: '', source: name, target: '*' })
    .spread(function (canonicalDir, pkgMeta) {
        openUrl(logger, pkgMeta);
    })
    .fail(function (error) {
        logger.emit('error', error);
    });

    return logger;
}

function openUrl(logger, pkgMeta) {
    var homepage = pkgMeta.homepage;

    // If no homepage is set, try to guess it
    // TODO: This might be unnecessary in the future as soon as the bower/json module
    //       applies normalization
    if (!homepage) {
        homepage = guessHomepage(pkgMeta);
    }

    // If in the end there's still no homepage, error out
    if (!homepage) {
        return logger.emit('error', createError('No homepage set for ' + name, 'ENOHOME'));
    }

    // Open URL
    open(homepage);

    logger.emit('end', homepage);
}

function guessHomepage(pkgMeta) {
    var homepage;

    // Convert GitHub URLs
    if (mout.string.startsWith(pkgMeta._source, 'git://github.com/')) {
        homepage = pkgMeta._source
        .replace('git://', 'https://')  // Convert to https
        .replace(/\.git$/, '');         // Remove trailing .git
    }

    return homepage;
}

// -------------------

home.line = function (argv) {
    var options = home.options(argv);
    var name = options.argv.remain[1];

    return home(name);
};

home.options = function (argv) {
    return cli.readOptions(argv);
};

home.completion = function () {
    // TODO:
};

module.exports = home;
