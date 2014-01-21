var mout = require('mout');
var Q = require('q');
var Logger = require('bower-logger');
var RegistryClient = require('bower-registry-client');
var cli = require('../util/cli');
var Tracker = require('../util/analytics').Tracker;
var defaultConfig = require('../config');

function search(name, config) {
    var registryClient;
    var promise;
    var tracker;
    var logger = new Logger();

    config = mout.object.deepFillIn(config || {}, defaultConfig);
    config.cache = config.storage.registry;

    registryClient = new RegistryClient(config, logger);
    tracker = new Tracker(config);

    // If no name was specified, list all packages
    if (!name) {
        promise = Q.nfcall(registryClient.list.bind(registryClient));
    // Otherwise search it
    } else {
        promise = Q.nfcall(registryClient.search.bind(registryClient), name);
    }

    promise
    .done(function (results) {
        tracker.track('searched', name);
        logger.emit('end', results);
    }, function (error) {
        logger.emit('error', error);
    });

    return logger;
}

// -------------------

search.line = function (argv) {
    var options = search.options(argv);
    return search(options.argv.remain.slice(1).join(' '), options);
};

search.options = function (argv) {
    return cli.readOptions(argv);
};

search.completion = function () {
    // TODO:
};

module.exports = search;
