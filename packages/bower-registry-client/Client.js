var os = require('os');
var path = require('path');
var async = require('async');
var methods = require('./lib');
var Cache = require('./lib/util/Cache');

function RegistryClient(config) {
    config = config || {};
    this._config = config;

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

    // Init the cache
    this._initCache();
}

// Add every method to the prototype
RegistryClient.prototype.lookup = methods.lookup;
RegistryClient.prototype.search = methods.search;
RegistryClient.prototype.list = methods.list;
RegistryClient.prototype.register = methods.register;

RegistryClient.prototype.clearCache = function (name, callback) {
    async.parallel([
        this.lookup.clearCache.bind(this, name),
        this.search.clearCache.bind(this, name),
        this.list.clearCache.bind(this)
    ], callback);
};

RegistryClient.prototype.resetCache = function (name) {
    this.lookup.resetCache.call(this, name);
    this.search.resetCache.call(this, name);
    this.list.resetCache.call(this);

    return this;
};

RegistryClient.clearRuntimeCache = function () {
    Cache.clearRuntimeCache();
};

// -----------------------------

RegistryClient.prototype._initCache = function () {
    var cache;
    var dir = this._config.cache;

    // Cache is stored/retrieved statically to ensure singularity
    // among instances
    cache = this.constructor._cache = this.constructor._cache || {};
    this._cache = cache[dir] = cache[dir] || {};

    this.lookup.initCache.call(this);
    this.search.initCache.call(this);
    this.list.initCache.call(this);
};

module.exports = RegistryClient;
