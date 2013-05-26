var os = require('os');
var path = require('path');
var methods = require('./lib');

var name;

function RegistryClient(config) {
    config = config || {};

    // Parse config
    // Registry
    config.registry = config.registry || 'https://bower.herokuapp.com';
    if (typeof config.registry === 'string') {
        config.registry = {
            search: [config.registry],
            register: config.registry,
            publish: config.registry
        };
    } else if (!Array.isArray(config.registry.search)) {
        config.registry.search = [config.registry.search];
    }

    // Ensure that every registry endpoint does not end with /
    config.registry.search = config.registry.search.map(function (url) {
        return url.replace(/\/+$/, '');
    });
    config.registry.register = config.registry.register.replace(/\/+$/, '');
    config.registry.publish = config.registry.publish.replace(/\/+$/, '');

    // CA
    if (!config.ca || typeof config.ca === 'string') {
        config.ca = {
            search: [config.ca],
            register: config.ca,
            publish: config.ca
        };
    } else if (!Array.isArray(config.ca.search)) {
        config.ca.search = [config.ca.search];
    }

    // Cache
    if (!config.cache) {
        config.cache = path.join(os.tmpdir ? os.tmpdir() : os.tmpDir(), 'bower-registry');
    }

    // Timeout
    if (typeof config.timeout !== 'number') {
        config.timeout = 5000;
    }

    // Strict ssl
    config.strictSsl = config.strictSsl == null ? true : !!config.strictSsl;

    // Store config and init the cache
    this._config = config;
    this._initCache();
}

// Add every method to the prototype
for (name in methods) {
    RegistryClient.prototype[name] = methods[name];
}

RegistryClient.prototype.clearCache = function (name, callback) {
    // TODO: call other methods once they are done
    this.lookup.clearCache.call(this, name, callback);
};

// -----------------------------

RegistryClient.prototype._initCache = function () {
    // TODO: call other methods once they are done
    this.lookup.initCache.call(this, this._config.cache);
};

module.exports = RegistryClient;
