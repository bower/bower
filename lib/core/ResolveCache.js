var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var semver = require('semver');
var mout = require('mout');
var Q = require('q');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');

function ResolveCache(config) {
    // TODO: Make some config entries, such as:
    //       - Max MB
    //       - Max versions per source
    //       - Max MB per source
    //       - etc..
    this._config = config;
    this._dir = this._config.roaming.cache;
    this._versions = {};

    mkdirp.sync(this._dir);
}

// -----------------

ResolveCache.prototype.retrieve = function (source, target) {
    var sourceId = this._getSourceId(source);
    var dir = path.join(this._dir, sourceId);

    target = target || '*';

    return this._getVersions(source)
    .then(function (versions) {
        var suitable;

        // If target is a semver, find a suitable version
        if (semver.valid(target) != null || semver.validRange(target) != null) {
            suitable = mout.array.find(versions, function (version) {
                return semver.satisfies(version, target);
            });

            if (suitable) {
                return suitable;
            }
        }

        // If target is '*' check if there's a cached '_unversioned'
        if (target === '*') {
            return mout.array.find(versions, function (version) {
                return version === '_unversioned';
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
        return this._readPkgMeta(canonicalPkg)
        .then(function (pkgMeta) {
            return [canonicalPkg, pkgMeta];
        });
    }.bind(this));
};

ResolveCache.prototype.store = function (canonicalPkg, pkgMeta) {
    var promise = pkgMeta ? Q.resolve(pkgMeta) : this._readPkgMeta(canonicalPkg);
    var sourceId;
    var pkgVersion;
    var dir;

    return promise
    .then(function (pkgMeta) {
        sourceId = this._getSourceId(pkgMeta._source);
        pkgVersion = pkgMeta.version || '_unversioned';
        dir = path.join(this._dir, sourceId, pkgVersion);

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
    }.bind(this))
    .then(function () {
        var pkgVersion = pkgMeta.version || '_unversioned';
        var versions = this._versions[sourceId];
        var inCache;

        if (versions) {
            // Check if this exact version already exists in the
            // memory cache
            inCache = versions.some(function (version) {
                return pkgVersion === version;
            });

            // If it doesn't, add it to the in memory cache
            // and sort the versions afterwards
            if (!inCache) {
                versions.push(pkgVersion);
                this._sortVersions(versions);
            }
        }

        // Resolve with the final location
        return dir;
    }.bind(this));
};

ResolveCache.prototype.eliminate = function (source, version) {
    // TODO:
};

ResolveCache.prototype.empty = function (source) {
    // TODO:
};

// ------------------------

ResolveCache.prototype._getSourceId = function (source) {
    return crypto.createHash('md5').update(source).digest('hex');
};


ResolveCache.prototype._readPkgMeta = function (dir) {
    return Q.nfcall(fs.readFile, path.join(dir, '.bower.json'))
    .then(function (contents) {
        return JSON.parse(contents.toString());
    });
};

ResolveCache.prototype._getVersions = function (source) {
    var dir;
    var sourceId = this._getSourceId(source);
    var cache = this._versions[sourceId];

    if (cache) {
        return Q.resolve(cache);
    }

    dir = path.join(this._dir, sourceId);

    return Q.nfcall(fs.readdir, dir)
    .then(function (versions) {
        // If there are no versions there, do not cache in memory
        if (!versions.length) {
            return versions;
        }

        // Sort and cache in memory
        this._sortVersions(versions);
        return this._versions[sourceId] = versions;
    }.bind(this), function (err) {
        // If the directory does not exists, resolve
        // as an empty array
        if (err.code === 'ENOENT') {
            return this._versions[sourceId] = [];
        }

        throw err;
    }.bind(this));
};

ResolveCache.prototype._sortVersions = function (versions) {
    versions.sort(function (version1, version2) {
        var validSemver1 = semver.valid(version1) != null;
        var validSemver2 = semver.valid(version2) != null;

        // If both are semvers, compare them
        if (validSemver1 && validSemver2) {
            if (semver.gt(version1, version2)) {
                return -1;
            }
            if (semver.lt(version1, version2)) {
                return 1;
            }
            return 0;
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

module.exports = ResolveCache;
