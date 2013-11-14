var chmodr = require('chmodr');
var cmd = require('../../util/cmd');
var createError = require('../../util/createError');
var defaultConfig = require('../../config');
var LRU = require('lru-cache');
var mkdirp = require('mkdirp');
var mout = require('mout');
var path = require('path');
var Q = require('q');
var Resolver = require('./Resolver');
var rimraf = require('rimraf');
var semver = require('../../util/semver');
var util = require('util');
var which = require('which');

var hasBzr;

// Check if bzr is installed
try {
    which.sync('bzr');
    hasBzr = true;
} catch (ex) {
    hasBzr = false;
}

function BzrResolver(decEndpoint, config, logger) {
    Resolver.call(this, decEndpoint, config, logger);

    if (!hasBzr) {
        throw createError('bzr is not installed or not in the PATH', 'ENOBZR');
    }
}

util.inherits(BzrResolver, Resolver);
mout.object.mixIn(BzrResolver, Resolver);

// -----------------

BzrResolver.prototype._hasNew = function (canonicalDir, pkgMeta) {
    var oldResolution = pkgMeta._resolution || {};

    return this._findResolution()
    .then(function (resolution) {
        // Check if resolution types are different
        if (oldResolution.type !== resolution.type) {
            return true;
        }

        // If resolved to a version, there is new content if the tags are not equal
        if (resolution.type === 'version' && semver.neq(resolution.tag, oldResolution.tag)) {
            return true;
        }

        // As last check, we compare both commit hashes
        return resolution.commit !== oldResolution.commit;
    });
};

BzrResolver.prototype._resolve = function () {
    var that = this;

    return this._findResolution()
    .then(function () {
        return that._checkout();
    });
};

// -----------------

BzrResolver.prototype._checkout = function () {
    var promise;
    var timer;
    var reporter;
    var that = this;
    var resolution = this._resolution;
    var args = [];

    this._logger.action('checkout', resolution.tag || resolution.branch || resolution.commit, {
        resolution: resolution,
        to: this._tempDir
    });

    args = ['export', this._tempDir, this._source ];

    if (resolution.commit !== '*') {
        args.push('-r'+ resolution.commit);
    }

    promise = cmd('bzr', args);

    return promise
    // Add additional proxy information to the error if necessary
    .fail(function (err) {
        throw err;
    })
};

// -----------------

BzrResolver.prototype._findResolution = function (target) {
    var err;
    var self = this.constructor;
    var that = this;

    target = target || this._target || '*';

    // XXX why even bother with this method now...
    this._resolution = { type: 'branch', commit: target };
    return Q.resolve(this._resolution);
};

BzrResolver.prototype._savePkgMeta = function (meta) {
    var version;

    if (this._resolution.type === 'version') {
        version = semver.clean(this._resolution.tag);

        // Warn if the package meta version is different than the resolved one
        if (typeof meta.version === 'string' && semver.neq(meta.version, version)) {
            this._logger.warn('mismatch', 'Version declared in the json (' + meta.version + ') is different than the resolved one (' + version + ')', {
                resolution: this._resolution,
                pkgMeta: meta
            });
        }

        // Ensure package meta version is the same as the resolution
        meta.version = version;
    } else {
        // If resolved to a target that is not a version,
        // remove the version from the meta
        delete meta.version;
    }

    // Save version/tag/commit in the release
    // Note that we can't store branches because _release is supposed to be
    // an unique id of this ref.
    meta._release = version ||
                    this._resolution.tag ||
                    this._resolution.commit.substr(0, 10);

    // Save resolution to be used in hasNew later
    meta._resolution = this._resolution;

    return Resolver.prototype._savePkgMeta.call(this, meta);
};

module.exports = BzrResolver;
