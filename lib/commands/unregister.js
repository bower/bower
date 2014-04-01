var chalk = require('chalk');
var Logger = require('bower-logger');
var mout = require('mout');
var Q = require('q');

var cli = require('../util/cli');
var createError = require('../util/createError');
var defaultConfig = require('../config');
var PackageRepository = require('../core/PackageRepository');
var Tracker = require('../util/analytics').Tracker;

function unregister(name, config) {
    var repository;
    var registryClient;
    var tracker;
    var logger = new Logger();
    var force;

    config = mout.object.deepFillIn(config || {}, defaultConfig);
    force = config.force;
    tracker = new Tracker(config);

    // Bypass any cache
    config.offline = false;
    config.force = true;

    // Trim name
    name = name.trim();

    repository = new PackageRepository(config, logger);

    process.nextTick(function () {
        // Verify name
        if (!name) {
            return logger.emit('error', createError('Please type a name', 'EINVNAME'));
        }

        tracker.track('unregister');

        Q.resolve()
        .then(function () {
            // If non interactive or user forced, bypass confirmation
            if (!config.interactive || force) {
                return true;
            }

            // Confirm if the user really wants to unregister
            return Q.nfcall(logger.prompt.bind(logger), {
                type: 'confirm',
                message: 'Unregistering a package will make it no longer installable via the registry (' +
                    chalk.cyan.underline(config.registry.register) + '), continue?',
                default: false
            });
        })
        .then(function (result) {
            // If user response was negative, abort
            if (!result) {
                return;
            }

            // Register
            registryClient = repository.getRegistryClient();

            logger.action('unregister', name, {
                name: name
            });

            return Q.nfcall(registryClient.unregister.bind(registryClient), name);
        })
        .done(function (result) {
            tracker.track('unregistered');
            logger.emit('end', result);
        }, function (error) {
            logger.emit('error', error);
        });
    });

    return logger;
}

// -------------------

unregister.line = function (argv) {
    var options = unregister.options(argv);
    var name = options.argv.remain[1];

    if (!name) {
        return null;
    }

    return unregister(name);
};

unregister.options = function (argv) {
    return cli.readOptions(argv);
};

unregister.completion = function () {
    // TODO:
};

module.exports = unregister;
