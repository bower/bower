var lang = require('mout/lang');
var object = require('mout/object');
var rc = require('./util/rc');
var defaults = require('./util/defaults');
var expand = require('./util/expand');
var EnvProxy = require('./util/proxy');
var path = require('path');
var fs = require('fs');

function Config(cwd) {
    this._cwd = cwd || process.cwd();
    this._proxy = new EnvProxy();
    this._config = {};
}

Config.prototype.load = function (overwrites) {
    this._config = rc('bower', defaults, this._cwd);

    this._config = object.merge(this._config, overwrites || {});

    this._config = Config.normalise(this._config);

    loadCAs(this._config.ca);

    this._proxy.set(this._config);

    return this;
};

Config.prototype.restore = function () {
  this._proxy.restore();
};

function readCertFile(path) {
    path = path || '';

    var sep = '-----END CERTIFICATE-----';

    var certificates;

    if (path.indexOf(sep) === -1) {
        certificates = fs.readFileSync(path, { encoding: 'utf8' });
    } else {
        certificates = path;
    }

    return certificates
        .split(sep)
        .filter(function(s) { return !s.match(/^\s*$/); })
        .map(function(s) { return s + sep; });
}

function loadCAs(caConfig) {
    // If a ca file path has been specified, expand that here to the file's
    // contents. As a user can specify these individually, we must load them
    // one by one.
    if (caConfig.search) {
        caConfig.search = caConfig.search.map(function(s) {
            return readCertFile(s);
        });
    }
    ['register', 'publish'].forEach(function(p) {
        if (caConfig[p]) {
            caConfig[p] = readCertFile(caConfig[p]);
        }
    });
}

Config.prototype.toObject = function () {
    return lang.deepClone(this._config);
};

Config.create = function (cwd) {
    return new Config(cwd);
};

Config.read = function (cwd, overrides) {
    var config = new Config(cwd);
    return config.load(overrides).toObject();
};

Config.normalise = function (rawConfig) {
    var config = {};

    // Mix in defaults and raw config
    object.deepMixIn(config, expand(defaults), expand(rawConfig));

    // Some backwards compatible things..
    config.shorthandResolver = config.shorthandResolver
    .replace(/\{\{\{/g, '{{')
    .replace(/\}\}\}/g, '}}');

    // Ensure that every registry endpoint does not end with /
    config.registry.search = config.registry.search.map(function (url) {
        return url.replace(/\/+$/, '');
    });
    config.registry.register = config.registry.register.replace(/\/+$/, '');
    config.registry.publish = config.registry.publish.replace(/\/+$/, '');
    config.tmp = path.resolve(config.tmp);

    return config;
};

Config.DEFAULT_REGISTRY = defaults.registry;

module.exports = Config;
