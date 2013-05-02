var fs = require('fs');
var path = require('path');
var Q = require('q');
var tmp = require('tmp');
var mkdirp = require('mkdirp');
var bowerJson = require('bower-json');
var glob = require('glob');
var config = require('../config');
var createError = require('../util/createError');

tmp.setGracefulCleanup();

var Resolver = function (source, options) {
    options = options || {};

    this._source = source;
    this._target = options.target || '*';
    this._name = options.name || path.basename(this._source);
    this._guessedName = !options.name;
    this._config = options.config || config;
};

// -----------------

Resolver.prototype.getSource = function () {
    return this._source;
};

Resolver.prototype.getName = function () {
    return this._name;
};

Resolver.prototype.getTarget = function () {
    return this._target;
};

Resolver.prototype.getTempDir = function () {
    return this._tempDir;
};

Resolver.prototype.hasNew = function (canonicalPkg) {
    var that = this,
        promise,
        metaFile;

    // If already working, error out
    if (this._working) {
        return Q.reject(createError('Already working', 'EWORKING'));
    }

    this._working = true;

    // Avoid reading the package meta if _hasNew was not rewritten
    if (this._hasNew === Resolver.prototype._hasNew) {
        promise = this._hasNew();
    // Otherwise call _hasNew with both the package meta and the canonical package
    } else {
        metaFile = path.join(canonicalPkg, '.bower.json');
        promise = Q.nfcall(fs.readFile, metaFile)
        .then(function (contents) {
            var pkgMeta = JSON.parse(contents.toString());
            return that._hasNew(pkgMeta, canonicalPkg);
        }, function () {
            return true;  // Simply resolve to true if there was an error reading the meta
        });
    }

    return promise.fin(function () {
        that._working = false;
    });
};

Resolver.prototype.resolve = function () {
    var that = this;

    // If already working, error out
    if (this._working) {
        return Q.reject(createError('Already working', 'EWORKING'));
    }

    this._working = true;

    // Create temporary dir
    return this._createTempDir()
    // Resolve self
    .then(this._resolve.bind(this))
    // Read json, generating the package meta
    .then(function () {
        return that._readJson(that._tempDir);
    })
    .then(function (meta) {
        return Q.all([
            // Apply package meta
            that._applyPkgMeta(meta),
            // Save package meta
            that._savePkgMeta(meta)
        ]);
    })
    .then(function () {
        // Resolve with the folder
        return that._tempDir;
    }, function (err) {
        // If something went wrong, unset the temporary dir
        that._tempDir = null;
        throw err;
    })
    .fin(function () {
        that._working = false;
    });
};

Resolver.prototype.getPkgMeta = function () {
    return this._pkgMeta;
};

// -----------------

Resolver.clearRuntimeCache = function () {};

// -----------------

// Abstract function that should be implemented by concrete resolvers
Resolver.prototype._resolve = function () {
    throw new Error('_resolve not implemented');
};

// -----------------

Resolver.prototype._hasNew = function (pkgMeta, canonicalPkg) {
    return Q.resolve(true);
};

Resolver.prototype._createTempDir = function () {
    var baseDir = path.join(tmp.tmpdir, 'bower');

    return Q.nfcall(mkdirp, baseDir)
    .then(function () {
        return Q.nfcall(tmp.dir, {
            template: path.join(baseDir, this._name + '-XXXXXX'),
            mode: 0777 & ~process.umask(),
            unsafeCleanup: true
        });
    }.bind(this))
    .then(function (dir) {
        this._tempDir = dir;
        return dir;
    }.bind(this));
};

Resolver.prototype._readJson = function (dir) {
    var deferred = Q.defer();

    Q.nfcall(bowerJson.find, dir)
    .then(function (filename) {
        // If it is a component.json, warn about the deprecation
        if (path.basename(filename) === 'component.json') {
            deferred.notify({
                type: 'warn',
                data: 'Package "' + this._name + '" is using the deprecated component.json file'
            });
        }

        // Read it
        return Q.nfcall(bowerJson.read, filename)
        .fail(function (err) {
            throw createError('Something went wrong while reading "' + filename + '"', err.code, {
                details: err.message
            });
        });
    }.bind(this), function () {
        // No json file was found, assume one
        return Q.nfcall(bowerJson.parse, { name: this._name });
    }.bind(this))
    .then(deferred.resolve, deferred.reject, deferred.notify);

    return deferred.promise;
};

Resolver.prototype._applyPkgMeta = function (meta) {
    // Check if name defined in the json is different
    if (meta.name !== this._name) {
        // If so and if the name was "guessed", assume the json name
        if (this._guessedName) {
            this._name = meta.name;
        // Otherwise force the configured one
        } else {
            meta.name = this._name;
        }
    }

    // Handle ignore property, deleting all files from the temporary directory
    if (meta.ignore && meta.ignore.length) {
        return Q.nfcall(glob, '**/*', { cwd: this._tempDir, dot: true, mark: true })
        .then(function (files) {
            var promises = [];

            // TODO
            return Q.all(promises);
        }.bind(this))
        .then(function () {
            return meta;
        });
    }

    return Q.resolve(meta);
};

Resolver.prototype._savePkgMeta = function (meta) {
    var contents = JSON.stringify(meta, null, 2);

    return Q.nfcall(fs.writeFile, path.join(this._tempDir, '.bower.json'), contents)
    .then(function () {
        return this._pkgMeta = meta;
    }.bind(this));
};

module.exports = Resolver;