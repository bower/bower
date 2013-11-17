var cmd = require('../../util/cmd');
var createError = require('../../util/createError');
var mout = require('mout');
var Q = require('q');
var Resolver = require('./Resolver');
var semver = require('../../util/semver');
var util = require('util');
var which = require('which');
var LRU = require('lru-cache');

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
    var resolution = this._resolution;
    var args = [];

    var spec = (resolution.type === 'version') ? 'tag' : resolution.type;

    this._logger.action('checkout', resolution.tag || resolution.commit, {
        resolution: resolution,
        to: this._tempDir
    });

    if (resolution.commit !== '*') {
        args.push('-r' + resolution.type + ':' + resolution.tag || resolution.revno);
    }

    promise = cmd('bzr',
                  ['branch', this._source, this._tempDir, '--use-existing-dir',
                  '-r' + spec + ':' + (resolution.tag || resolution.commit)]);

    return promise
    // Add additional proxy information to the error if necessary
    .fail(function (err) {
        throw err;
    });
};

// -----------------

BzrResolver.prototype._findResolution = function (target) {
    var err;
    var self = this.constructor;
    var that = this;

    target = target || this._target || '*';

    // bzr help revisionspec
    // http://wiki.bazaar.canonical.com/BzrRevisionSpec

    // Target is a revno, so it's a stale target (not a moving target)
    // There's nothing to do in this case
    if ((/^[revno|tag]:/).test(target)) {
        target = target.split(':');

        if (target.length < 2) {
            err = createError('Invalid revisionspec', 'ENOREVISIONSPEC');
            throw err;
        }

        this._resolution = { type: target[0], commit: target[1] };
        return Q.resolve(this._resolution);
    }

    if (semver.validRange(target)) {
        return self.versions(this._source, true)
        .then(function (versions) {
            var versionsArr,
                version,
                index;

            versionsArr = versions.map(function (obj) { return obj.version; });

            // If there are no tags and target is *,
            // fallback to the latest revno
            if (!versions.length && target === '*') {
                return that._findResolution('revno:-1');
            }

            versionsArr = versions.map(function (obj) { return obj.version; });
            // Find a satisfying version, enabling strict match so that pre-releases
            // have lower priority over normal ones when target is *
            index = semver.maxSatisfyingIndex(versionsArr, target, true);
            if (index !== -1) {
                version = versions[index];
                return that._resolution = { type: 'version', tag: version.tag, commit: version.commit };
            }

            // Check if there's an exact branch/tag with this name as last resort
            return Q.all([
                self.tags(that._source)
            ])
            .then(function (tags) {
                // Use hasOwn because a branch/tag could have a name like "hasOwnProperty"
                if (mout.object.hasOwn(tags, target)) {
                    return that._resolution = { type: 'tag', tag: target, commit: tags[target] };
                }

                throw createError('No tag found that was able to satisfy ' + target, 'ENORESTARGET', {
                    details: !versions.length ?
                        'No versions found in ' + that._source :
                        'Available versions: ' + versions.map(function (version) { return version.version; }).join(', ')
                });
            });
        });
    }

    // Otherwise, target is a non semver tag, or error
    return Q.all(self.tags(that._source))
    .then(function (tags) {
        // Use hasOwn because a branch/tag could have a name like "hasOwnProperty"
        if (mout.object.hasOwn(tags, target)) {
            return that._resolution = { type: 'tag', tag: target, commit: tags[target] };
        }

        tags = Object.keys(tags);

        err = createError('Tag ' + target + ' does not exist', 'ENORESTARGET');
        err.details = !tags.length ?
                'No tags found in ' + that._source :
                'Available tags: ' + tags.join(', ');

        throw err;
    });

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

BzrResolver.tags = function (source) {
    var value = this._cache.tags.get(source);

    if (value) {
        return Q.resolve(value);
    }

    value = cmd('bzr', ['tags', '-d' + source])
    .spread(function (stout) {
        var lines;
        var tags = [];

        lines = stout.toString()
        .trim()
        .replace(/[\t ]+/g, ' ')
        .split(/[\r\n]+/);

        lines.forEach(function (line) {
            var match = line.match(/^(.*?)(\d+)$/);

            if (match) {
                tags[match[1].trim()] = match[2];
            }

        });

        this._cache.tags.set(source, tags);

        return tags;
    }.bind(this));

    // Store the promise to be reused until it resolves
    // to a specific value
    this._cache.tags.set(source, value);

    return value;
};

BzrResolver.versions = function (source, extra) {

    var value = this._cache.versions.get(source);

    if (value) {
        return Q.resolve(value)
        .then(function () {
            var versions = this._cache.versions.get(source);

            // If no extra information was requested,
            // resolve simply with the versions
            if (!extra) {
                versions = versions.map(function (version) {
                    return version.version;
                });
            }

            return versions;
        }.bind(this));
    }

    value = this.tags(source)
    .then(function (tags) {
        var tag;
        var version;
        var versions = [];

        for (tag in tags) {
            version = semver.clean(tag);
            if (version) {
                versions.push({ version: version, tag: tag, commit: tags[tag] });
            }
        }

        // Sort them by DESC order
        versions.sort(function (a, b) {
            return semver.rcompare(a.version, b.version);
        });

        this._cache.versions.set(source, versions);

        // Call the function again to keep it DRY
        return this.versions(source, extra);
    }.bind(this));

    // Store the promise to be reused until it resolves
    // to a specific value
    this._cache.versions.set(source, value);

    return value;
};

BzrResolver.clearRuntimeCache = function () {
    // Reset cache for branches, tags, etc
    mout.object.forOwn(BzrResolver._cache, function (lru) {
        lru.reset();
    });
};

BzrResolver._cache = {
    branches: new LRU({ max: 50, maxAge: 5 * 60 * 1000 }),
    tags: new LRU({ max: 50, maxAge: 5 * 60 * 1000 }),
    versions: new LRU({ max: 50, maxAge: 5 * 60 * 1000 }),
    refs: new LRU({ max: 50, maxAge: 5 * 60 * 1000 })
};

module.exports = BzrResolver;
