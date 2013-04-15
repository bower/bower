var util = require('util');
var fs = require('fs');
var path = require('path');
var events = require('events');
var Q = require('q');
var tmp = require('tmp');
var mkdirp = require('mkdirp');
var config = require('../config');
var createError = require('../util/createError');

var Resolver = function (source, options) {
    options = options || {};

    this._source = source;
    this._target = options.target || '*';
    this._name = options.name;
    this._guessedName = !this.name;
    this._config = options.config || config;
};

util.inherits(Resolver, events.EventEmitter);

// -----------------

Resolver.prototype.getSource = function () {
    return this._name;
};

Resolver.prototype.getTarget = function () {
    return this._target;
};

Resolver.prototype.getTempDir = function () {
    return this._tempDir;
};

Resolver.prototype.resolve = function () {
    // Create temporary dir
    return this._createTempDir()
    // Resolve self
    .then(this._resolveSelf.bind(this))
    // Read json
    .then(this._readJson.bind(this))
    // Parse json
    .then(this._parseJson.bind(this));
};

Resolver.prototype.hasNew = function (oldResolution) {
    return Q.resolve(true);
};

Resolver.prototype.getDependencies = function () {
    return this._json.dependencies;
};

// -----------------

// Abstract function that should be implemented by concrete resolvers
Resolver.prototype._resolveSelf = function () {};

// -----------------

Resolver.prototype._createTempDir = function () {
    var baseDir = path.join(tmp.tmpdir, 'bower');

    return Q.nfcall(mkdirp, baseDir)
    .then(function () {
        return Q.nfcall(tmp.dir, {
            template: path.join(baseDir, this._name + '-XXXXXX'),
            mode: parseInt('0777', 8) & (~process.umask()),
            //unsafeCleanup: true // TODO: don't forget enable this
        });
    }.bind(this))
    .then(function (dir) {
        // TODO: remove this
        require('../util/cmd')('open', [dir]);

        this._tempDir = dir;
        return dir;
    }.bind(this));
};

Resolver.prototype._readJson = function () {
    var jsonFile;

    // Try bower.json
    jsonFile = path.join(this.getTempDir(), 'bower.json');
    return Q.nfcall(fs.readFile, jsonFile)
    // Try component.json
    .then(null, function (err) {
        if (err.code !== 'ENOENT') {
            throw err;
        }

        jsonFile = path.join(this.getTempDir(), 'component.json');
        return Q.nfcall(fs.readFile, jsonFile)
        // Issue a deprecation message if it exists
        .then(function (contents) {
            this.emit('warn', 'Package "' + this.name + '" is using the deprecated component.json file');
            return contents;
        }.bind(this));
    }.bind(this))
    // If we got the file contents, validate them
    .then(function (contents) {
        // TODO: change the validation to a separate module in the bower organization
        try {
            this._json = JSON.parse(contents);
            return this._json;
        } catch (e) {
            throw createError('Unable to parse "' + jsonFile + '" file', e.code, {
                details: e.message
            });
        }
    // Otherwise there was an error
    }.bind(this), function (err) {
        // If no json file was found, return one just with the name
        if (err.code === 'ENOENT') {
            this._json = { name: this.name };
            return this._json;
        }

        // If we got here, the error code is something else so we re-throw it
        throw err;
    }.bind(this));
};

Resolver.prototype._parseJson = function () {
    // Check if name defined in the json is different
    // If so and if the name was "guessed", assume the json name
    if (this._guessedName && this._json.name !== this.name) {
        this.name = this._json.name;
        this.emit('name_change', this.name);
    }

    this._json.dependencies = this._json.dependencies || {};

    // Handle ignore property, deleting all files from the temporary directory
    return Q.fcall(function () {
        // Delete all the files specified in the ignore from the temporary directory
        // TODO:
    }.bind(this));
};

module.exports = Resolver;