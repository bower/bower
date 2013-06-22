var EventEmitter = require('events').EventEmitter;
var mout = require('mout');
var RegistryClient = require('bower-registry-client');
var cli = require('../util/cli');
var defaultConfig = require('../config');

function search(name, options, config) {
    var registryClient;
    var emitter = new EventEmitter();
    var funcName;

    options = options || {};
    config = mout.object.deepMixIn(config || {}, defaultConfig);
    config.cache = config.paths.registry;

    registryClient = new RegistryClient(config);

    // If no name was specified, list all packages
    if (!name) {
        funcName = 'list';
    // Otherwise search it
    } else {
        funcName = 'search';
    }

    registryClient[funcName](name, function (err, results) {
        if (err) {
            return emitter.emit('error', err);
        }

        return emitter.emit('end', results);
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
