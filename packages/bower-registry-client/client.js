var os = require('os');
var path = require('path');
var rimraf = require('rimraf');
var info = require('./lib/info');
var lookup = require('./lib/lookup');
var search = require('./lib/search');
var register = require('./lib/register');

var RegistryClient = function (options) {
    options = options || {};

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
    options.strictSsl = options.strictSsl == null ? true : !! options.strictSsl;

    this._options = options;
};

RegistryClient.prototype.clearCache = function (name, callback) {
    if (typeof name === 'function') {
        callback = name;
        name = null;
    }

    if (!name) {
        rimraf(this._options.cache, callback);
    } else {
        // TODO: switch to async parallel and call clear cache of all commands
        this.lookup.clearCache(name, callback);
    }
};

RegistryClient.prototype.lookup = lookup;
RegistryClient.prototype.search = search;
RegistryClient.prototype.register = register;
RegistryClient.prototype.info = info;

module.exports = RegistryClient;