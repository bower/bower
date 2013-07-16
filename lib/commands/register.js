var EventEmitter = require('events').EventEmitter;
var mout = require('mout');
var Q = require('q');
var promptly = require('promptly');
var RegistryClient = require('bower-registry-client');
var PackageRepository = require('../core/PackageRepository');
var Logger = require('../core/Logger');
var cli = require('../util/cli');
var createError = require('../util/createError');
var defaultConfig = require('../config');

function register(name, url, config) {
    var repository;
    var registryClient;
    var emitter = new EventEmitter();
    var logger = new Logger();
    var force;

    config = mout.object.deepFillIn(config || {}, defaultConfig);
    force = config.force;

    // Bypass any cache
    config.offline = false;
    config.force = true;

    name = name.trim();

    // Verify name
    // TODO: Verify with the new spec regexp?
    if (!name) {
        process.nextTick(function () {
            emitter.emit('error', createError('Please type a name', 'EINVNAME'));
        });

        return emitter;
    }

    // Ensure the URL starts with git://
    // TODO: After the registry server is rewritten this might change
    if (!mout.string.startsWith(url, 'git://')) {
        process.nextTick(function () {
            emitter.emit('error', createError('The registry only accepts URLs starting with git://', 'EINVFORMAT'));
        });

        return emitter;
    }

    // Attempt to resolve the package referenced by the URL to ensure
    // everything is ok before registering
    repository = new PackageRepository(config, logger);
    repository.fetch({ name: name, source: url, target: '*' })
    .then(function () {
        // If non interactive or user forced, bypass confirmation
        if (!config.interactive || force) {
            return true;
        }

        // Confirm if the user really wants to register
        return Q.nfcall(promptly.confirm, 'Registering a package will make it visible and installable via the registry, continue? (y/n)');
    })
    .then(function (result) {
        // If user response was negative, abort
        if (!result) {
            return;
        }

        // Register
        logger.action('register', url, {
            name: name,
            url: url
        });

        config.cache = config.storage.registry;
        registryClient = new RegistryClient(config);

        return Q.nfcall(registryClient.register.bind(registryClient), name, url);
    })
    .then(function (result) {
        emitter.emit('end', result);
    })
    .fail(function (error) {
        emitter.emit('error', error);
    });

    return logger.pipe(emitter);
}

// -------------------

register.line = function (argv) {
    var options = register.options(argv);
    var name = options.argv.remain[1];
    var url = options.argv.remain[2];

    if (!name || !url) {
        return null;
    }

    return register(name, url);
};

register.options = function (argv) {
    return cli.readOptions(argv);
};

register.completion = function () {
    // TODO:
};

module.exports = register;
