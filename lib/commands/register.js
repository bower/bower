var mout = require('mout');
var Q = require('q');
var chalk = require('chalk');
var PackageRepository = require('../core/PackageRepository');
var Logger = require('bower-logger');
var Config = require('bower-config');
var cli = require('../util/cli');
var createError = require('../util/createError');
var defaultConfig = require('../config');
var GitHubResolver = require('../core/resolvers/GitHubResolver');

function register(name, url, config) {
    var repository;
    var registryClient;
    var logger = new Logger();
    var force;

    config = mout.object.deepFillIn(config || {}, defaultConfig);
    force = config.force;

    // Bypass any cache
    config.offline = false;
    config.force = true;

    // Trim name
    name = name.trim();

    process.nextTick(function () {
        // Verify name
        // TODO: Verify with the new spec regexp?
        if (!name) {
            return logger.emit('error', createError('Please type a name', 'EINVNAME'));
        }

        // The public registry only allows git:// endpoints
        // As such, we attempt to convert URLs as necessary
        if (config.registry.register === Config.DEFAULT_REGISTRY) {
            url = convertUrl(url, logger);

            if (!mout.string.startsWith(url, 'git://')) {
                return logger.emit('error', createError('The registry only accepts URLs starting with git://', 'EINVFORMAT'));
            }
        }

        // Attempt to resolve the package referenced by the URL to ensure
        // everything is ok before registering
        repository = new PackageRepository(config, logger);
        repository.fetch({ name: name, source: url, target: '*' })
        .spread(function (canonicalDir, pkgMeta) {
            if (pkgMeta.private) {
                throw createError('The package you are trying to register is marked as private', 'EPRIV');
            }

            // If non interactive or user forced, bypass confirmation
            if (!config.interactive || force) {
                return true;
            }

            // Confirm if the user really wants to register
            return Q.nfcall(logger.prompt.bind(logger), {
                type: 'confirm',
                message: 'Registering a package will make it installable via the registry (' +
                    chalk.cyan.underline(config.registry.register) + '), continue?',
                default: true
            });
        })
        .then(function (result) {
            // If user response was negative, abort
            if (!result) {
                return;
            }

            // Register
            registryClient = repository.getRegistryClient();

            logger.action('register', url, {
                name: name,
                url: url
            });

            return Q.nfcall(registryClient.register.bind(registryClient), name, url);
        })
        .then(function (result) {
            logger.emit('end', result);
        })
        .fail(function (error) {
            logger.emit('error', error);
        });
    });

    return logger;
}

function convertUrl(url, logger) {
    var pair;
    var newUrl;

    // Convert GitHub ssh & https to git://
    pair = GitHubResolver.getOrgRepoPair(url);
    if (pair) {
        newUrl = 'git://github.com/' + pair.org + '/' + pair.repo + '.git';
        logger.warn('convert', 'Converted ' + url + ' to ' + newUrl);
    }

    return newUrl || url;
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
