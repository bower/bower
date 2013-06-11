var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var semver = require('semver');
var mout = require('mout');
var Q = require('q');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var LRU = require('lru-cache');
var createError = require('../util/createError');

function ResolveCache(config) {
    // TODO: Make some config entries, such as:
    //       - Max MB
    //       - Max versions per source
    //       - Max MB per source
    //       - etc..
    this._config = config;
    this._dir = this._config.roaming.cache;

    this._cache = this.constructor._cache.get(this._dir);
    if (!this._cache) {
        this._cache = new LRU({
            max: 100,
            maxAge: 60 * 30 * 1000  // 30 minutes
        });
        this.constructor._cache.set(this._dir, this._cache);
    }

    // Ensure dir is created
    mkdirp.sync(this._dir);
}

// -----------------

ResolveCache.prototype.retrieve = function (source, target) {
    var fromCache;
    var sourceId = this._getSourceId(source);
    var dir = path.join(this._dir, sourceId);
    var that = this;

    target = target || '*';

    return this._getVersions(sourceId)
    .spread(function (versions, cached) {
        var suitable;

        fromCache = cached;

        // If target is a semver, find a suitable version
        if (semver.valid(target) != null || semver.validRange(target) != null) {
            suitable = mout.array.find(versions, function (version) {
                return semver.satisfies(version, target);
            });

            if (suitable) {
                return suitable;
            }
        }

        // If target is '*' check if there's a cached '_wildcard'
        if (target === '*') {
            return mout.array.find(versions, function (version) {
                return version === '_wildcard';
            });
        }

        // Otherwise check if there's an exact match
        return mout.array.find(versions, function (version) {
            return version === target;
        });
    })
    .then(function (version) {
        var canonicalPkg;

        if (!version) {
            return [];
        }

        // Resolve with canonical package and package meta
        canonicalPkg = path.join(dir, version);
        return that._readPkgMeta(canonicalPkg)
        .then(function (pkgMeta) {
            return [canonicalPkg, pkgMeta];
        }, function (err) {
            // If the version was fetched from the cache and we got
            // a ENOENT error, it means that the in memory cache is
            // no longer valid.
            // As such we eliminate it.
            if (fromCache && err.code === 'ENOENT') {
                that._cache.del(sourceId);
            }
        });
    });
};

ResolveCache.prototype.store = function (canonicalPkg, pkgMeta) {
    var sourceId;
    var release;
    var dir;
    var promise;
    var that = this;

    promise = pkgMeta ? Q.resolve(pkgMeta) : this._readPkgMeta(canonicalPkg);

    return promise
    .then(function (pkgMeta) {
        release = pkgMeta.version || (pkgMeta._target === '*' ? '_wildcard' : pkgMeta._target);
        sourceId = that._getSourceId(pkgMeta._source);
        dir = path.join(that._dir, sourceId, release);

        // Check if directory exists
        return Q.nfcall(fs.stat, dir)
        .then(function () {
            // If it does exists, remove it
            return Q.nfcall(rimraf, dir);
        }, function (err) {
            // If directory does not exists, ensure its basename
            // is created
            if (err.code === 'ENOENT') {
                return Q.nfcall(mkdirp, path.dirname(dir));
            }

            throw err;
        })
        // Move the canonical to sourceId/target
        .then(function () {
            return Q.nfcall(fs.rename, canonicalPkg, dir);
        });
    })
    .then(function () {
        var versions = that._cache.get(sourceId);

        // Add it to the in memory cache
        // and sort the versions afterwards
        if (versions && versions.indexOf(release) === -1) {
            versions.push(release);
            that._sortVersions(versions);
        }

        // Resolve with the final location
        return dir;
    });
};

ResolveCache.prototype.eliminate = function (pkgMeta) {
    var sourceId = this._getSourceId(pkgMeta._source);
    var version = pkgMeta.version || '_wildcard';
    var dir = path.join(this._dir, sourceId, version);
    var that = this;

    return Q.nfcall(rimraf, dir)
    .then(function () {
        var versions = that._cache.get(sourceId) || [];
        mout.array.remove(versions, version);

        // If this was the last package in the cache,
        // delete the parent folder (source)
        // For extra security, we check against the file system
        // this was the last package
        if (!versions.length) {
            that._cache.del(sourceId);
            versions = that._getVersions(sourceId);
            if (!versions.length) {
                return Q.nfcall(rimraf, path.dirname(dir));
            }
        }
    });
};

ResolveCache.prototype.clean = function () {
    return Q.nfcall(rimraf, this._dir)
    .then(function () {
        this._cache.reset();
    }.bind(this));
};

ResolveCache.prototype.list = function () {
    var promises;
    var dirs = [];
    var that = this;

    // Get the list of directories
    return Q.nfcall(fs.readdir, this._dir)
    .then(function (sourceIds) {
        promises = sourceIds.map(function (sourceId) {
            return Q.nfcall(fs.readdir, path.join(that._dir, sourceId))
            .then(function (versions) {
                versions.forEach(function (version) {
                    var dir = path.join(that._dir, sourceId, version);
                    dirs.push(dir);
                });
            }, function (err) {
                // Ignore lurking files
                if (err.code === 'ENOTDIR') {
                    return;
                }

                throw err;
            });
        });

        return Q.all(promises);
    })
    // Read every package meta
    .then(function () {
        promises = dirs.map(function (dir) {
            return that._readPkgMeta(dir)
            .then(function (pkgMeta) {
                return pkgMeta;
            });
        });

        return Q.all(promises);
    })
    // Sort by name ASC & version ASC
    .then(function (pkgMetas) {
        return pkgMetas.sort(function (pkgMeta1, pkgMeta2) {
            var comp = pkgMeta1.name.localeCompare(pkgMeta2.name);

            if (comp) {
                return comp;
            }

            if (pkgMeta1.version && pkgMeta2.version) {
                return semver.compare(pkgMeta1.version, pkgMeta2.version);
            }
            if (pkgMeta1.version) {
                return -1;
            }
            if (pkgMeta2.version) {
                return 1;
            }

            return 0;
        });
    });
};

// ------------------------

ResolveCache.clearRuntimeCache = function () {
    this._cache.reset();
};

// ------------------------


ResolveCache.prototype._getSourceId = function (source) {
    return crypto.createHash('md5').update(source).digest('hex');
};


ResolveCache.prototype._readPkgMeta = function (dir) {
    var filename = path.join(dir, '.bower.json');

    return Q.nfcall(fs.readFile, filename)
    .then(function (contents) {
        return JSON.parse(contents.toString());
    })
    .fail(function (err) {
        throw createError('Something went wrong while reading "' + filename + '"', err.code, {
            details: err.message,
            data: {
                json: filename
            }
        });
    });
};

ResolveCache.prototype._getVersions = function (sourceId) {
    var dir;
    var versions = this._cache.get(sourceId);
    var that = this;

    if (versions) {
        return Q.resolve([versions, true]);
    }

    dir = path.join(this._dir, sourceId);
    return Q.nfcall(fs.readdir, dir)
    .then(function (versions) {
        // Sort and cache in memory
        that._sortVersions(versions);
        that._cache.set(sourceId, versions);
        return [versions, false];
    }, function (err) {
        // If the directory does not exists, resolve
        // as an empty array
        if (err.code === 'ENOENT') {
            versions = [];
            that._cache.set(sourceId, versions);
            return [versions, false];
        }

        throw err;
    });
};

ResolveCache.prototype._sortVersions = function (versions) {
    // Sort DESC
    versions.sort(function (version1, version2) {
        var validSemver1 = semver.valid(version1) != null;
        var validSemver2 = semver.valid(version2) != null;

        // If both are semvers, compare them
        if (validSemver1 && validSemver2) {
            return semver.rcompare(version1, version2);
        }

        // If one of them are semvers, give higher priority
        if (validSemver1) {
            return -1;
        }
        if (validSemver2) {
            return 1;
        }

        // Otherwise they are considered equal
        return 0;
    });
};

// ------------------------

ResolveCache._cache = new LRU({
    max: 5,
    maxAge: 60 * 30 * 1000  // 30 minutes
});

module.exports = ResolveCache;
