var EventEmitter = require('events').EventEmitter;
var mout = require('mout');
var RegistryClient = require('bower-registry-client');
var cli = require('../util/cli');
var defaultConfig = require('../config');

function lookup(name, options, config) {
    var registryClient;
    var emitter = new EventEmitter();

    options = options || {};
    config = mout.object.deepMixIn(config || {}, defaultConfig);
    config.cache = config.storage.registry;

    registryClient = new RegistryClient(config);
    registryClient.lookup(name, function (err, entry) {
        if (err) {
            return emitter.emit('error', err);
        }

        // TODO: Handle entry.type.. for now it's only 'alias'
        //       When we got published packages, this needs to be adjusted
        emitter.emit('end', !entry ? null : {
            name: name,
            url: entry && entry.url
        });
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

    return lookup(name, options);
};

lookup.options = function (argv) {
    return cli.readOptions(argv);
};

lookup.completion = function () {
    // TODO:
};

module.exports = lookup;
