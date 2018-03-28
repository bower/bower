var Q = require('q');
var PackageRepository = require('../core/PackageRepository');
var defaultConfig = require('../config');
var cli = require('../util/cli');
var createError = require('../util/createError');

function search(logger, name, config) {
    var registryClient;

    config = defaultConfig(config);

    var repository = new PackageRepository(config, logger);
    var registryClient = repository.getRegistryClient();

    if (name) {
        return Q.nfcall(registryClient.search.bind(registryClient), name);
    } else {
        // List all packages when in interactive mode + json enabled, and
        // always when in non-interactive mode
        if (config.interactive && !config.json) {
            throw createError('no parameter to bower search', 'EREADOPTIONS');
        }

        return Q.nfcall(registryClient.list.bind(registryClient));
    }
}

// -------------------

search.readOptions = function(argv) {
    var options = cli.readOptions(argv);
    var terms = options.argv.remain.slice(1);

    var name = terms.join(' ');

    return [name];
};

module.exports = search;
