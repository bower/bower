var Q = require('q');
var RegistryClient = require('bower-registry-client');
var Tracker = require('../util/analytics').Tracker;
var defaultConfig = require('../config');
var bowerConfig = require('../../lib').config;
var cli = require('../util/cli');

function search(logger, name, config) {
    var registryClient;
    var tracker;

    config = defaultConfig(config);
    config.cache = config.storage.registry;

    registryClient = new RegistryClient(config, logger);
    tracker = new Tracker(config);
    tracker.track('search', name);

    // Search if the user has given a name query
    if (name) {
        return Q.nfcall(registryClient.search.bind(registryClient), name);
    }
    // List all packages when in interactive mode + json enabled, and
    // always when in non-interactive mode
    else if (bowerConfig.json || !config.interactive) {
        return Q.nfcall(registryClient.list.bind(registryClient));
    }
}

// -------------------

search.readOptions = function (argv) {
    var options = cli.readOptions(argv);
    var terms = options.argv.remain.slice(1);

    // When searching from the CLI, we expect at least one search term.
    if (terms.length <= 0) {
        throw cli.createReadOptionsError('search');
    }

    var name = terms.join(' ');

    return [name];
};

module.exports = search;
