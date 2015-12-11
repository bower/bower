var Q = require('q');
var RegistryClient = require('bower-registry-client');
var Tracker = require('../util/analytics').Tracker;
var defaultConfig = require('../config');
var cli = require('../util/cli');

function search(logger, name, config) {
    var registryClient;
    var tracker;

    var json = config ? config.json : undefined;
    config = defaultConfig(config);
    config.json = config.json || json; // Hack until bower-config is fixed...
    config.cache = config.storage.registry;

    registryClient = new RegistryClient(config, logger);
    tracker = new Tracker(config);
    tracker.track('search', name);

    if (name) {
        return Q.nfcall(registryClient.search.bind(registryClient), name);
    } else {
        // List all packages when in interactive mode + json enabled, and
        // always when in non-interactive mode
        if (config.interactive && !config.json) {
            throw cli.createReadOptionsError('search');
        }

        return Q.nfcall(registryClient.list.bind(registryClient));
    }
}

// -------------------

search.readOptions = function (argv) {
    var options = cli.readOptions(argv);
    var terms = options.argv.remain.slice(1);

    var name = terms.join(' ');

    return [name];
};

module.exports = search;
