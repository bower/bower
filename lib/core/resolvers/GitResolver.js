var util = require('util');
var path = require('path');
var Q = require('q');
var semver = require('semver');
var chmodr = require('chmodr');
var rimraf = require('rimraf');
var mout = require('mout');
var Resolver = require('./Resolver');
var createError = require('../../util/createError');

var GitResolver = function (source, options) {
    Resolver.call(this, source, options);
};

util.inherits(GitResolver, Resolver);
mout.object.mixIn(GitResolver, Resolver);

// -----------------

GitResolver.prototype._hasNew = function (pkgMeta) {
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

GitResolver.prototype._resolve = function () {
    var deferred = Q.defer();

    deferred.notify({ type: 'action', data: 'Finding resolution' });

    this._findResolution()
    .then(function (resolution) {
        deferred.notify({ type: 'action', data: 'Checking out "' + (resolution.tag || resolution.branch || resolution.commit) + '"' });

        return this._checkout()
        // Always run cleanup after checkout to ensure that .git is removed!
        // If it's not removed, problems might arrise when the "tmp" module attemps
        // to delete the temporary folder
        .fin(function () {
            deferred.notify({ type: 'action', data: 'Cleaning up' });

            this._cleanup();
        }.bind(this));
    }.bind(this))
    .then(deferred.resolve, deferred.reject, deferred.notify);

    return deferred.promise;
};

// -----------------

// Abstract functions that should be implemented by concrete git resolvers
GitResolver.prototype._checkout = function () {
    throw new Error('_checkout not implemented');
};

GitResolver.fetchRefs = function (source) {
    throw new Error('fetchRefs not implemented');
};

// -----------------

GitResolver.prototype._findResolution = function (target) {
    var err;
    var self = this.constructor;

    target = target || this._target;

    // Target is a commit, so it's a stale target (not a moving target)
    // There's nothing to do in this case
    if ((/^[a-f0-9]{40}$/).test(target)) {
        this._resolution = { type: 'commit', commit: target };
        return Q.resolve(this._resolution);
    }

    // Target is a range/version
    if (semver.valid(target) != null || semver.validRange(target) != null) {
        return self.fetchVersions(this._source)
        .then(function (versions) {
            // If there are no tags and target is *,
            // fallback to the latest commit on master
            if (!versions.length && target === '*') {
                return this._findResolution('master');
            }

            // Find the highest one that satisfies the target
            var version = mout.array.find(versions, function (version) {
                return semver.satisfies(version.version, target);
            }, this);

            if (!version) {
                throw createError('No tag found that was able to satisfy "' + target + '"', 'ENORESTARGET', {
                    details: !versions.length ?
                        'No versions found in "' + this._source + '"' :
                        'Available versions: ' + versions.map(function (version) { return version.version; }).join(', ')
                });
            }

            return this._resolution = { type: 'version', tag: version.tag, commit: version.commit };
        }.bind(this));
    }

    // Otherwise, target is either a tag or a branch
    // Start by checking if is a valid tag
    return self.fetchTags(this._source)
    .then(function (tags) {
        if (mout.object.hasOwn(tags, target)) {
            return this._resolution = { type: 'tag', tag: target, commit: tags[target] };
        }

        // Finally check if is a valid branch
        return self.fetchBranches(this._source)
        .then(function (branches) {
            // Use hasOwn because a branch could have a name like "hasOwnProperty"
            if (!mout.object.hasOwn(branches, target)) {
                branches = Object.keys(branches);
                tags = Object.keys(tags);

                err = createError('Tag/branch "' + target + '" does not exist', 'ENORESTARGET');
                err.details = !tags.length ?
                        'No tags found in "' + this._source + '"' :
                        'Available tags: ' + tags.join(', ');
                err.details += '\n';
                err.details += !branches.length ?
                        'No branches found in "' + this._source + '"' :
                        'Available branches: ' + branches.join(', ');

                throw err;
            }

            return this._resolution = { type: 'branch', branch: target, commit: branches[target] };
        }.bind(this));
    }.bind(this));
};

GitResolver.prototype._cleanup = function () {
    var gitFolder = path.join(this._tempDir, '.git');

    // Remove the .git folder
    // Note that on windows, we need to chmod to 0777 before due to a bug in git
    // See: https://github.com/isaacs/rimraf/issues/19
    if (process.platform === 'win32') {
        return Q.nfcall(chmodr, gitFolder, 0777)
        .then(function () {
            return Q.nfcall(rimraf, gitFolder);
        }, function (err) {
            // If .git does not exist, chmodr returns ENOENT
            // so, we ignore that error code
            if (err.code !== 'ENOENT') {
                throw err;
            }
        });
    } else {
        return Q.nfcall(rimraf, gitFolder);
    }
};

GitResolver.prototype._savePkgMeta = function (meta) {
    var deferred = Q.defer();
    var version;

    if (this._resolution.type === 'version') {
        version = semver.clean(this._resolution.tag);

        // Warn if the package meta version is different than the resolved one
        if (typeof meta.version === 'string' && semver.neq(meta.version, version)) {
            process.nextTick(function (metaVersion) {
                deferred.notify({
                    type: 'warn',
                    data: 'Version declared in the json (' + metaVersion + ') is different than the resolved one (' + version + ')'
                });
            }.bind(this, meta.version));
        }

        // Ensure package meta version is the same as the resolution
        meta.version = version;
    } else {
        // If resolved to a target that is not a version,
        // remove the version from the meta
        delete meta.version;
    }

    // Save version/commit/branch/tag in the release
    meta._release = version || this._resolution.tag || this._resolution.commit;

    // Save resolution to be used in hasNew later
    meta._resolution = this._resolution;

    Resolver.prototype._savePkgMeta.call(this, meta)
    .then(deferred.resolve, deferred.reject, deferred.notify);

    return deferred.promise;
};

// ------------------------------

GitResolver.fetchVersions = function (source) {
    if (this._versions && this._versions[source]) {
        return Q.resolve(this._versions[source]);
    }

    return this.fetchTags(source)
    .then(function (tags) {
        var versions = [];
        var tag;
        var version;

        // For each tag
        for (tag in tags) {
            version = semver.clean(tag);
            if (version) {
                versions.push({ version: version, tag: tag, commit: tags[tag] });
            }
        }

        // Sort them by desc order
        versions = versions.sort(function (a, b) {
            return semver.gt(a.version, b.version) ? -1 : 1;
        });

        this._versions = this._versions  || {};
        return this._versions[source] = versions;
    }.bind(this));
};

GitResolver.fetchTags = function (source) {
    if (this._tags && this._tags[source]) {
        return Q.resolve(this._tags[source]);
    }

    return this.fetchRefs(source)
    .then(function (refs) {
        var tags = [];

        // For each line in the refs, match only the tags
        refs.forEach(function (line) {
            var match = line.match(/^([a-f0-9]{40})\s+refs\/tags\/(\S+)/);
            var tag;

            if (match) {
                tag = match[2];
                tags[match[2]] = match[1];
            }
        });

        this._tags = this._tags  || {};
        return this._tags[source] = tags;
    }.bind(this));
};

GitResolver.fetchBranches = function (source) {
    if (this._branches && this._branches[source]) {
        return Q.resolve(this._branches[source]);
    }

    return  this.fetchRefs(source)
    .then(function (refs) {
        this._branches = this._branches || {};
        var branches = this._branches[source] = this._branches[source] || {};

        // For each line in the refs, extract only the heads
        // Organize them in an object where keys are branches and values
        // the commit hashes
        refs.forEach(function (line) {
            var match = line.match(/^([a-f0-9]{40})\s+refs\/heads\/(\S+)/);

            if (match) {
                branches[match[2]] = match[1];
            }
        });

        return branches;
    }.bind(this));
};

GitResolver.clearRuntimeCache = function () {
    this._branches = null;
    this._tags = null;
    this._versions = null;
    this._refs = null;
};

module.exports = GitResolver;
