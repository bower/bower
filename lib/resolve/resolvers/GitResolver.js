var util = require('util');
var path = require('path');
var Q = require('q');
var semver = require('semver');
var chmodr = require('chmodr');
var rimraf = require('rimraf');
var mout = require('mout');
var Resolver = require('../Resolver');
var createError = require('../../util/createError');

var GitResolver = function (source, options) {
    Resolver.call(this, source, options);

    // Guess the name
    if (this._guessedName) {
        this._name = path.basename(this._source, '.git');
    }
};

util.inherits(GitResolver, Resolver);

// -----------------

GitResolver.prototype._resolveSelf = function () {
    return this._findResolution()
    .then(function () {
        return this._checkout()
        // Always run cleanup after checkout to ensure that .git is removed!
        // If it's not removed, problems might arrise when the "tmp" module attemps
        // to delete the temporary folder
        .fin(this._cleanup.bind(this));
    }.bind(this));
};

GitResolver.prototype.hasNew = function (canonicalPkg) {
    var oldResolution;

    return this._readJson(canonicalPkg)
    .then(function (meta) {
        oldResolution = meta._resolution || {};
    })
    .then(this._findResolution.bind(this))
    .then(function (resolution) {
        // Check if resolution types are different
        if (oldResolution.type !== resolution.type) {
            return true;
        }

        // If resolved to a tag, there is new content if the tags are not equal
        if (resolution.type === 'tag' && semver.neq(resolution.tag, oldResolution.tag)) {
            return true;
        }

        // As last check, we compare both commit hashes
        return resolution.commit !== oldResolution.commit;
    });
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
    var branches,
        self = this.constructor;

    target = target || this._target;

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
                        'Available versions in "' + this._source + '" are: ' + versions.map(function (version) { return version.version; }).join(', ')
                });
            }

            return this._resolution = { type: 'tag', tag: version.tag, commit: version.commit };
        }.bind(this));
    }

    // Target is a commit, so it's a stale target (not a moving target)
    // There's nothing to do in this case
    if ((/^[a-f0-9]{40}$/).test(target)) {
        this._resolution = { type: 'commit', commit: target };
        return Q.resolve(this._resolution);
    }

    // Otherwise, assume target is a branch
    return self.fetchHeads(this._source)
    .then(function (heads) {
        // Use hasOwn because a branch could have a name like "hasOwnProperty"
        if (!mout.object.hasOwn(heads, target)) {
            branches = Object.keys(heads);
            throw createError('Branch "' + target + '" does not exist', 'ENORESTARGET', {
                details: !branches.length ?
                    'No branches found in "' + this._source + '"' :
                    'Available branches in "' + this._source + '" are: ' + branches.join(', ')
            });
        }

        return this._resolution = { type: 'branch', branch: target, commit: heads[target] };
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
    // Ensure that the .version is fulfilled with the resolution
    // version if any
    // TODO: emit a warning if the json version is different than the resolved one
    //       also add a test for this stuff
    meta.version = this._resolution.version;

    // Save resolution to be used in hasNew later
    meta._resolution = this._resolution;

    return Resolver.prototype._savePkgMeta.call(this, meta);
};

// ------------------------------

GitResolver.fetchVersions = function (source) {
    if (this._versions && this._versions[source]) {
        return Q.resolve(this._versions[source]);
    }

    return this.fetchRefs(source)
    .then(function (refs) {
        var versions = [];

        // For each line in the refs, match only the tags
        refs.forEach(function (line) {
            var match = line.match(/^([a-f0-9]{40})\s+refs\/tags\/(\S+)/),
                tag,
                version;

            // Ensure it's valid
            if (match) {
                tag = match[2];
                version = semver.clean(tag);
                if (version) {
                    versions.push({ version: version, tag: tag, commit: match[1] });
                }
            }
        });

        // Sort them by desc order
        versions = versions.sort(function (a, b) {
            return semver.gt(a.version, b.version) ? -1 : 1;
        });

        this._versions = this._versions  || {};
        return this._versions[source] = versions;
    }.bind(this));
};

GitResolver.fetchHeads = function (source) {
    if (this._heads && this._heads[source]) {
        return Q.resolve(this._heads[source]);
    }

    return  this.fetchRefs(source)
    .then(function (refs) {
        this._heads = this._heads || {};
        var heads = this._heads[source] = this._heads[source] || {};

        // For each line in the refs, extract only the heads
        // Organize them in an object where keys are branches and values
        // the commit hashes
        refs.forEach(function (line) {
            var match = line.match(/^([a-f0-9]{40})\s+refs\/heads\/(\S+)/);

            if (match) {
                heads[match[2]] = match[1];
            }
        });

        return heads;
    }.bind(this));
};

module.exports = GitResolver;
