var Q = require('q');
var chalk = require('chalk');
var PackageRepository = require('../core/PackageRepository');
var createError = require('../util/createError');
var defaultConfig = require('../config');

function register(logger, name, source, config) {
    var repository;
    var registryClient;
    var force;
    var url;
    var githubSourceRegex = /^\w[\w-]*\/\w[\w-]*$/;
    var getGithubUrl = function (source) {
        return 'git@github.com:' + source + '.git';
    };

    config = defaultConfig(config);
    force = config.force;

    name = (name || '').trim();
    source = (source || '').trim();

    url = source.match(githubSourceRegex) ? getGithubUrl(source) : source;

    // Bypass any cache
    config.offline = false;
    config.force = true;

    return Q.try(function () {
        // Verify name and url
        if (!name || !url) {
            throw createError('Usage: bower register <name> <url>', 'EINVFORMAT');
        }

        // Attempt to resolve the package referenced by the URL to ensure
        // everything is ok before registering
        repository = new PackageRepository(config, logger);
        return repository.fetch({ name: name, source: url, target: '*' });
    })
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
    });
}

// -------------------

register.readOptions = function (argv) {
    var cli = require('../util/cli');

    var options = cli.readOptions(argv);
    var name = options.argv.remain[1];
    var url = options.argv.remain[2];

    return [name, url];
};

module.exports = register;
