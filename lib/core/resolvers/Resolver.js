var fs = require('graceful-fs');
var path = require('path');
var Q = require('q');
var tmp = require('tmp');
var mkdirp = require('mkdirp');
var bowerJson = require('bower-json');
var createError = require('../../util/createError');
var removeIgnores = require('../../util/removeIgnores');

tmp.setGracefulCleanup();

function Resolver(decEndpoint, config, logger) {
    this._source = decEndpoint.source;
    this._target = decEndpoint.target || '*';
    this._name = decEndpoint.name || path.basename(this._source);

    this._config = config;
    this._logger = logger;

    this._guessedName = !decEndpoint.name;
}

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

Resolver.prototype.getPkgMeta = function () {
    return this._pkgMeta;
};

Resolver.prototype.hasNew = function (canonicalDir, pkgMeta) {
    var promise;
    var metaFile;
    var that = this;

    // If already working, error out
    if (this._working) {
        return Q.reject(createError('Already working', 'EWORKING'));
    }

    this._working = true;

    // Avoid reading the package meta if already given
    if (pkgMeta) {
        promise = this._hasNew(canonicalDir, pkgMeta);
    // Otherwise call _hasNew with both the package meta and the canonical dir
    } else {
        metaFile = path.join(canonicalDir, '.bower.json');

        promise = Q.nfcall(bowerJson.read, metaFile)
        .then(function (pkgMeta) {
            return that._hasNew(canonicalDir, pkgMeta);
        }, function () {
            return true;  // Simply resolve to true if there was an error reading the file
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
    .then(this._readJson.bind(this, null))
    // Apply and save package meta
    .then(function (meta) {
        return that._applyPkgMeta(meta)
        .then(that._savePkgMeta.bind(that, meta));
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

// -----------------

// Abstract functions that must be implemented by concrete resolvers
Resolver.prototype._resolve = function () {
    throw new Error('_resolve not implemented');
};

// Abstract functions that can be re-implemented by concrete resolvers
// as necessary
Resolver.prototype._hasNew = function (canonicalDir, pkgMeta) {
    return Q.resolve(true);
};

Resolver.isTargetable = function () {
    return true;
};

Resolver.versions = function (source) {
    return Q.resolve([]);
};

Resolver.clearRuntimeCache = function () {};

// -----------------

Resolver.prototype._createTempDir = function () {
    var baseDir = path.join(this._config.tmp, 'bower');

    return Q.nfcall(mkdirp, baseDir)
    .then(function () {
        return Q.nfcall(tmp.dir, {
            template: path.join(baseDir, this._name + '-' + process.pid + '-XXXXXX'),
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
    dir = dir || this._tempDir;

    return Q.nfcall(bowerJson.find, dir)
    .then(function (filename) {
        // If it is a component.json, warn about the deprecation
        if (path.basename(filename) === 'component.json') {
            this._logger.warn('deprecated', 'Package ' + this._name + ' is using the deprecated component.json file', {
                json: filename
            });
        }

        // Read it
        return Q.nfcall(bowerJson.read, filename)
        .fail(function (err) {
            throw createError('Something went wrong while reading ' + filename, err.code, {
                details: err.message,
                data: {
                    json: filename
                }
            });
        });
    }.bind(this), function () {
        // No json file was found, assume one
        return Q.nfcall(bowerJson.parse, {
            name: this._name
        });
    }.bind(this));
};

Resolver.prototype._applyPkgMeta = function (meta) {
    // Check if name defined in the json is different
    // If so and if the name was "guessed", assume the json name
    if (meta.name !== this._name && this._guessedName) {
        this._name = meta.name;
    }

    // Handle ignore property, deleting all files from the temporary directory
    // If no ignores were specified, simply resolve
    if (!meta.ignore || !meta.ignore.length) {
        return Q.resolve(meta);
    }

    // Otherwise remove them from the temp dir
    return removeIgnores(this._tempDir, meta.ignore)
    .then(function () {
        return meta;
    });
};

Resolver.prototype._savePkgMeta = function (meta) {
    var contents;

    // Store original source & target
    meta._source = this._source;
    meta._target = this._target;

    // Stringify contents
    contents = JSON.stringify(meta, null, 2);

    return Q.nfcall(fs.writeFile, path.join(this._tempDir, '.bower.json'), contents)
    .then(function () {
        return this._pkgMeta = meta;
    }.bind(this));
};

module.exports = Resolver;
