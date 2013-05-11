var os = require('os');
var path = require('path');
var info = require('./info');
var lookup = require('./lookup');
var search = require('./search');
var register = require('./register');

var RegistryClient = function (options) {
    options = options || {};

    // Parse options
    // Registry
    options.registry = options.registry || 'https://bower.herokuapp.com';
    if (typeof options.registry !== 'object') {
        options.registry = {
            search: [options.registry],
            register: options.registry,
            publish: options.registry
        };
    } else if (!Array.isArray(options.registry.search)) {
        options.registry.search = [options.registry.search];
    }

    // Ensure that every registry endpoint does not end with /
    options.registry.search = options.registry.search.map(function (url) {
        return url.replace(/\/+$/, '');
    });
    options.registry.register = options.registry.register.replace(/\/+$/, '');
    options.registry.publish = options.registry.publish.replace(/\/+$/, '');

    // CA
    if (typeof options.ca !== 'object') {
        options.ca = {
            search: [options.ca],
            register: options.ca,
            publish: options.ca
        };
    } else if (!Array.isArray(options.ca.search)) {
        options.ca.search = [options.ca.search];
    }

    // Cache
    if (!options.cache) {
        options.cache = path.join(os.tmpdir ? os.tmpdir() : os.tmpDir(), 'bower-registry');
    }

    // Timeout
    if (typeof options.timeout !== 'number') {
        options.timeout = 5000;
    }

    // Strict ssl
    options.strictSsl = options.strictSsl == null ? true : !!options.strictSsl;

    // Store config and init the cache
    this._config = options;
    this._initCache();
};

RegistryClient.prototype.lookup = lookup;

RegistryClient.prototype.search = search;

RegistryClient.prototype.register = register;

RegistryClient.prototype.info = info;

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