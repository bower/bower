var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var semver = require('semver');
var mout = require('mout');
var Q = require('q');
var mkdirp = require('mkdirp');

var ResolveCache = function (dir) {
    // TODO: Make some options, such as:
    //       - Max MB
    //       - Max versions per source
    //       - Max MB per source
    //       - etc..
    this._dir = dir;
    this._versions = {};

    mkdirp.sync(dir);
};

ResolveCache.prototype.retrieve = function (source, target) {
    var sourceId = this._getSourceId(source);
    var dir = path.join(this._dir, sourceId);

    target = target || '*';

    return this._getVersions(source)
    .then(function (versions) {
        var suitable;

        console.log('cached versions for', source, versions);
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
            console.log('no cached package', source, target);
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

    return promise
    .then(function (pkgMeta) {
        var dir;

        sourceId = this._getSourceId(pkgMeta._source);
        pkgVersion = pkgMeta.version || '_unversioned';
        dir = path.join(this._dir, sourceId, pkgVersion);

        // Create sourceId directory
        return Q.nfcall(mkdirp, path.dirname(dir))
        // Move the canonical to sourceId/target
        .then(function () {
            return Q.nfcall(fs.rename, canonicalPkg, dir);
        });
    }.bind(this))
    .then(function () {
        var pkgVersion = pkgMeta.version || '_unversioned';
        var versions = this._versions[sourceId];
        var inCache;

        // Check if this exact version already exists in cache
        inCache = versions && versions.some(function (version) {
            return pkgVersion === version;
        });

        // If it doesn't, add it to the in memory cache
        // and sort the versions afterwards
        if (!inCache) {
            versions.push(pkgVersion);
            this._sortVersions(versions);
        }
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
            if (semver.gt(validSemver1, validSemver2)) {
                return -1;
            } else if (semver.lt(validSemver1, validSemver2)) {
                return 1;
            } else {
                return 0;
            }
        // If one of them are semvers, give higher priority
        } else if (validSemver1) {
            return -1;
        } else if (validSemver2) {
            return 1;
        }

        // Otherwise they are considered equal
        return 0;
    });
};

module.exports = ResolveCache;