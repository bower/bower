var util = require('util');
var path = require('path');
var Q = require('q');
var rimraf = require('rimraf');
var which = require('which');
var LRU = require('lru-cache');
var mout = require('mout');
var Resolver = require('./Resolver');
var semver = require('../../util/semver');
var createError = require('../../util/createError');
var cmd = require('../../util/cmd');

var hasSvn;

// Check if svn is installed
try {
    which.sync('svn');
    hasSvn = true;
} catch (ex) {
    hasSvn = false;
}

function SvnResolver(decEndpoint, config, logger) {
    Resolver.call(this, decEndpoint, config, logger);

    if (!hasSvn) {
        throw createError('svn is not installed or not in the PATH', 'ENOSVN');
    }
}

util.inherits(SvnResolver, Resolver);
mout.object.mixIn(SvnResolver, Resolver);

// -----------------

SvnResolver.prototype._hasNew = function (canonicalDir, pkgMeta) {
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

SvnResolver.prototype._resolve = function () {
    var that = this;

    return this._findResolution()
    .then(function () {
        return that._checkout()
        // Always run cleanup after checkout to ensure that .svn is removed!
        // If it's not removed, problems might arise when the "tmp" module attempts
        // to delete the temporary folder
        .fin(function () {
            return that._cleanup();
        });
    });
};

// -----------------

// Abstract functions that should be implemented by concrete git resolvers
SvnResolver.prototype._checkout = function () {
    throw new Error('_checkout not implemented');
};

// -----------------

SvnResolver.prototype._findResolution = function (target) {
    var err;
    var self = this.constructor;
    var that = this;

    target = target || this._target || '*';

    // Target is a revision, so it's a stale target (not a moving target)
    // There's nothing to do in this case
    if ((/^r\d+/).test(target)) {
        target = target.split('r');

        this._resolution = { type: 'revision', commit: target[1] };
        return Q.resolve(this._resolution);
    }

    // Target trunk
    if (target === 'trunk') {
        this._resolution = { type: 'trunk' };
        return Q.resolve(this._resolution);
    }

    // Target is a range/version
    if (semver.validRange(target)) {
        return self.versions(this._source, true)
        .then(function (versions) {
            var versionsArr,
                version,
                index;

            versionsArr = versions.map(function (obj) { return obj.version; });

            // If there are no tags and target is *,
            // fallback to the latest revision
            if (!versions.length && target === '*') {
                return that._findResolution('trunk');
            }

            versionsArr = versions.map(function (obj) { return obj.version; });
            // Find a satisfying version, enabling strict match so that pre-releases
            // have lower priority over normal ones when target is *
            index = semver.maxSatisfyingIndex(versionsArr, target, true);

            if (index !== -1) {
                version = versions[index];
                return that._resolution = { type: 'tag', tag: version.tag, commit: version.commit };
            }

            // Check if there's an exact branch/tag with this name as last resort
            return Q.all([
                self.branches(that._source),
                self.tags(that._source)
            ])
            .spread(function (branches, tags) {
                // Use hasOwn because a branch/tag could have a name like "hasOwnProperty"
                if (mout.object.hasOwn(tags, target)) {
                    return that._resolution = { type: 'tag', tag: target, commit: tags[target] };
                }
                if (mout.object.hasOwn(branches, target)) {
                    return that._resolution = { type: 'branch', branch: target, commit: branches[target] };
                }

                throw createError('No tag found that was able to satisfy ' + target, 'ENORESTARGET', {
                    details: !versions.length ?
                        'No versions found in ' + that._source :
                        'Available versions: ' + versions.map(function (version) { return version.version; }).join(', ')
                });
            });
        });
    }

    // Otherwise, target is either a tag or a branch
    return Q.all([
        self.branches(that._source),
        self.tags(that._source)
    ])
    .spread(function (branches, tags) {
        // Use hasOwn because a branch/tag could have a name like "hasOwnProperty"
        if (mout.object.hasOwn(tags, target)) {
            return that._resolution = { type: 'tag', tag: target, commit: tags[target] };
        }
        if (mout.object.hasOwn(branches, target)) {
            return that._resolution = { type: 'branch', branch: target, commit: branches[target] };
        }

        branches = Object.keys(branches);
        tags = Object.keys(tags);

        err = createError('Tag/branch ' + target + ' does not exist', 'ENORESTARGET');
        err.details = !tags.length ?
                'No tags found in ' + that._source :
                'Available tags: ' + tags.join(', ');
        err.details += '\n';
        err.details += !branches.length ?
                'No branches found in ' + that._source :
                'Available branches: ' + branches.join(', ');

        throw err;
    });
};

SvnResolver.prototype._cleanup = function () {
    var svnFolder = path.join(this._tempDir, '.svn');

    return Q.nfcall(rimraf, svnFolder);
};

SvnResolver.prototype._savePkgMeta = function (meta) {
    var version;

    if (this._resolution.type === 'revision') {
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
                    this._resolution.branch ||
                    this._resolution.commit;

    // Save resolution to be used in hasNew later
    meta._resolution = this._resolution;

    return Resolver.prototype._savePkgMeta.call(this, meta);
};

// ------------------------------

SvnResolver.versions = function (source, extra) {
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

        // For each tag
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

SvnResolver.tags = function (source) {
    var value = this._cache.tags.get(source);

    if (value) {
        return Q.resolve(value);
    }

    value = cmd('svn', ['list', source + '/tags'])
    .spread(function (stout) {
        var tags = [];

        var lines = stout.toString()
        .trim()
        .replace(/\/+/g, '')
        .split(/[\r\n]+/);

        // For each line in the refs, match only the tags
        lines.forEach(function (tag) {
            tags[tag] = tag;
        });

        this._cache.tags.set(source, tags);

        return tags;
    }.bind(this));

    // Store the promise to be reused until it resolves
    // to a specific value
    this._cache.tags.set(source, value);

    return value;
};

SvnResolver.branches = function (source) {
    var value = this._cache.branches.get(source);

    if (value) {
        return Q.resolve(value);
    }

    value = cmd('svn', ['list', source + '/branches'])
    .spread(function (stout) {
        var branches = [];

        var lines = stout.toString()
        .trim()
        .replace(/\/+/g, '')
        .split(/[\r\n]+/);

        // For each line in the refs, match only the tags
        lines.forEach(function (branch) {
            branches[branch] = branch;
        });

        this._cache.branches.set(source, branches);

        return branches;
    }.bind(this));

    // Store the promise to be reused until it resolves
    // to a specific value
    this._cache.branches.set(source, value);

    return value;
};

SvnResolver.clearRuntimeCache = function () {
    // Reset cache for branches, tags, etc
    mout.object.forOwn(SvnResolver._cache, function (lru) {
        lru.reset();
    });
};

SvnResolver._cache = {
    branches: new LRU({ max: 50, maxAge: 5 * 60 * 1000 }),
    tags: new LRU({ max: 50, maxAge: 5 * 60 * 1000 }),
    versions: new LRU({ max: 50, maxAge: 5 * 60 * 1000 })
};

module.exports = SvnResolver;
