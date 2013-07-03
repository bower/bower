var EventEmitter = require('events').EventEmitter;
var mout = require('mout');
var Q = require('q');
var RegistryClient = require('bower-registry-client');
var cli = require('../util/cli');
var defaultConfig = require('../config');

function search(name, config) {
    var registryClient;
    var promise;
    var emitter = new EventEmitter();

    config = mout.object.deepMixIn(config || {}, defaultConfig);
    config.cache = config.storage.registry;

    registryClient = new RegistryClient(config);

    // If no name was specified, list all packages
    if (!name) {
        promise = Q.nfcall(registryClient.list.bind(registryClient));
    // Otherwise search it
    } else {
        promise = Q.nfcall(registryClient.search.bind(registryClient), name);
    }

    promise
    .then(function (results) {
        emitter.emit('end', results);
    })
    .fail(function (error) {
        emitter.emit('error', error);
    });

    return emitter;
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
