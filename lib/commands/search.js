var EventEmitter = require('events').EventEmitter;
var mout = require('mout');
var RegistryClient = require('bower-registry-client');
var cli = require('../util/cli');
var defaultConfig = require('../config');

function search(name, config) {
    var registryClient;
    var emitter = new EventEmitter();

    config = mout.object.deepMixIn(config || {}, defaultConfig);
    config.cache = config.storage.registry;

    registryClient = new RegistryClient(config);

    // If no name was specified, list all packages
    if (!name) {
        registryClient.list(onResults.bind(onResults, emitter));
    // Otherwise search it
    } else {
        registryClient.search(name, onResults.bind(onResults, emitter));
    }

    return emitter;
}

function onResults(emitter, error, results) {
    if (error) {
        return emitter.emit('error', error);
    }

    emitter.emit('end', results);
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
