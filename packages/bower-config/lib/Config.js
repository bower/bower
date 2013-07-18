var os = require('os');
var path = require('path');
var mout = require('mout');
var rc = require('./util/rc');
var paths = require('./util/paths');

// Guess proxy defined in the env
/*jshint camelcase: false*/
var proxy = process.env.HTTP_PROXY
    || process.env.http_proxy
    || null;

var httpsProxy = process.env.HTTPS_PROXY
    || process.env.https_proxy
    || process.env.HTTP_PROXY
    || process.env.http_proxy
    || null;
/*jshint camelcase: true*/

//-------------

function Config(cwd) {
    this._cwd = cwd || process.cwd();
    this._config = {};
}

Config.prototype.load = function () {
    var runtimeConfig;

    runtimeConfig = rc('bower', {
        'cwd': this._cwd,
        'directory': 'bower_components',
        'registry': 'https://bower.herokuapp.com',
        'shorthand-resolver': 'git://github.com/{{owner}}/{{package}}.git',
        'tmp': os.tmpdir ? os.tmpdir() : os.tmpDir(),
        'proxy': proxy,
        'https-proxy': httpsProxy,
        'timeout': 60000,
        'ca': null,
        'strict-ssl': true,
        'user-agent': 'node/' + process.version + ' ' + process.platform + ' ' + process.arch,
        'color': true,
        'interactive': false,
        'storage': {
            packages: path.join(paths.cache, 'packages'),
            links: path.join(paths.data, 'links'),
            completion: path.join(paths.data, 'completion'),
            registry: path.join(paths.cache, 'registry'),
            git: path.join(paths.data, 'git')
        }
    }, this._cwd);

    // Some backwards compatible things..
    runtimeConfig['shorthand-resolver'] = runtimeConfig['shorthand-resolver']
    .replace(/\{\{\{/g, '{{')
    .replace(/\}\}\}/g, '}}');

    // Generate config based on the rc, making every key camelCase
    this._config = {};
    mout.object.forOwn(runtimeConfig, function (value, key) {
        key = key.replace(/_/g, '-');
        this._config[mout.string.camelCase(key)] = value;
    }, this);

    return this;
};

Config.prototype.get = function (key) {
    // TODO
};

Config.prototype.set = function (key, value) {
    // TODO
    return this;
};

Config.prototype.del = function (key, value) {
    // TODO
    return this;
};

Config.prototype.save = function (where, callback) {
    // TODO
};

Config.prototype.toObject = function () {
    return mout.lang.deepClone(this._config);
};

Config.create = function (cwd) {
    return new Config(cwd);
};

Config.read = function (cwd) {
    var config = new Config(cwd);
    return config.load().toObject();
};

module.exports = Config;
