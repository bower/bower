var EventEmitter = require('events').EventEmitter;
var mout = require('mout');
var Q = require('q');
var RegistryClient = require('bower-registry-client');
var cli = require('../util/cli');
var defaultConfig = require('../config');

function lookup(name, config) {
    var registryClient;
    var emitter = new EventEmitter();

    config = mout.object.deepFillIn(config || {}, defaultConfig);
    config.cache = config.storage.registry;

    registryClient = new RegistryClient(config);

    Q.nfcall(registryClient.lookup.bind(registryClient), name)
    .then(function (entry) {
        // TODO: Handle entry.type.. for now it's only 'alias'
        //       When we got published packages, this needs to be adjusted
        emitter.emit('end', !entry ? null : {
            name: name,
            url: entry && entry.url
        });
    })
    .fail(function (error) {
        emitter.emit('error', error);
    });

    return emitter;
}

// -------------------

lookup.line = function (argv) {
    var options = lookup.options(argv);
    var name = options.argv.remain[1];

    if (!name) {
        return null;
    }

    return lookup(name);
};

lookup.options = function (argv) {
    return cli.readOptions(argv);
};

lookup.completion = function () {
    // TODO:
};

module.exports = lookup;
