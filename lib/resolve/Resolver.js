var util = require('util');
var fs = require('fs');
var path = require('path');
var events = require('events');
var Q = require('q');
var tmp = require('tmp');
var mkdirp = require('mkdirp');
var bowerJson = require('bower-json');
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

Resolver.prototype.hasNew = function (canonicalPkg) {
    return Q.resolve(true);
};

Resolver.prototype.resolve = function () {
    // Create temporary dir
    return this._createTempDir()
    // Resolve self
    .then(this._resolveSelf.bind(this))
    // Read json, generating the package meta
    .then(function () {
        return this._readJson(this._tempDir);
    }.bind(this))
    .then(function (meta) {
        return Q.all([
            // Apply package meta
            this._applyPkgMeta(meta),
            // Save package meta
            this._savePkgMeta(meta)
        ]);
    }.bind(this))
    .then(function () {
        // Resolve with the folder
        return this._tempDir;
    });
};

Resolver.prototype.getPkgMeta = function () {
    return this._pkgMeta;
};

// -----------------

// Abstract function that should be implemented by concrete resolvers
Resolver.prototype._resolveSelf = function () {
    throw new Error('_resolveSelf not implemented');
};

// -----------------

Resolver.prototype._createTempDir = function () {
    var baseDir = path.join(tmp.tmpdir, 'bower');

    return Q.nfcall(mkdirp, baseDir)
    .then(function () {
        return Q.nfcall(tmp.dir, {
            template: path.join(baseDir, this._name + '-XXXXXX'),
            mode: parseInt('0777', 8) & (~process.umask())
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

Resolver.prototype._readJson = function (dir) {
    return Q.nfcall(bowerJson.find, dir)
    .then(function (filename) {
        // If it is a component.json, warn about the deprecation
        if (path.basename(filename) === 'component.json') {
            this.emit('warn', 'Package "' + this.name + '" is using the deprecated component.json file');
        }

        // Read it
        return Q.nfcall(bowerJson.read, filename)
        .then(null, function (err) {
            throw createError('Something went wrong when reading "' + filename + '"', err.code, {
                details: err.message
            });
        });
    }.bind(this), function () {
        // No json file was found, assume one
        return Q.nfcall(bowerJson.parse, { name: this._name });
    }.bind(this));
};

Resolver.prototype._applyPkgMeta = function (meta) {
    // Check if name defined in the json is different
    // If so and if the name was "guessed", assume the json name
    if (this._guessedName && meta.name !== this.name) {
        this.name = meta.name;
        this.emit('name_change', this.name);
    }

    // Handle ignore property, deleting all files from the temporary directory
    return Q.fcall(function () {
        // Delete all the files specified in the ignore from the temporary directory
        // TODO:
    }.bind(this));
};

Resolver.prototype._savePkgMeta = function (meta) {
    var contents = JSON.stringify(meta, null, 2);

    return Q.nfcall(fs.writeFile, path.join(this._tempDir, '.bower.json'), contents)
    .then(function () {
        this._pkgMeta = meta;
    }.bind(this));
};
module.exports = Resolver;