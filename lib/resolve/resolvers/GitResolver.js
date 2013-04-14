var util = require('util');
var Q = require('q');
var semver = require('semver');
var mout = require('mout');
var Resolver = require('../Resolver');
var createError = require('../../util/createError');

var GitResolver = function (source, options) {
    Resolver.call(this, source, options);

    // Set the source path to be the same as the original source by default
    this._sourcePath = this._source;
};

util.inherits(GitResolver, Resolver);

// -----------------

GitResolver.prototype.hasNew = function (oldTarget, oldResolution) {
    return this._findResolution()
    .then(function (resolution) {
        // Resolution types are different
        if (oldResolution.type !== resolution.type) {
            return true;
        }

        // If resolved to a tag
        // There is new content if the tags are not equal
        if (resolution.type === 'tag') {
            return semver.neq(resolution.tag, oldResolution.tag);
        }

        // If resolved to a commit hash, just check if they are different
        // Use the same strategy if it the resolution is to a branch
        return resolution.commit !== oldResolution.commit;
    });
};

GitResolver.prototype._findResolution = function () {
    var promise,
        branches,
        target,
        self = this.constructor;

    // Target is a range/version
    if (semver.valid(this._target) || semver.validRange(this._target)) {
        return self.fetchVersions(this._sourcePath)
        .then(function (versions) {
            // Find the highest one that satifies the target
            var version = mout.array.find(versions, function (version) {
                return semver.satisfies(version, this._target);
            }, this);

            if (!version) {
                throw createError('No tag found that was able to satisfy "' + this._target + '"', 'ENORESTARGET', {
                    details: !versions.length ?
                        'No tags found in "' + this._source + '"' :
                        'Available tags in "' + this._source + '" are: ' + versions.join(', ')
                });
            }

            return { type: 'tag', tag: version };
        }.bind(this));
    }

    // Resolve the rest to a commit version
    promise = self.fetchHeads(this._sourcePath);

    // Target is a commit, so it's a stale target (not a moving target)
    // There's nothing to do in this case
    if ((/^[a-f0-9]{40}$/).test(this._target)) {
        return Q.resolve({ type: 'commit', commit: this._target });
    }

    // If target is *, use master branch
    target = this._target === '*' ? 'master' : this._target;

    // Target is a branch
    return promise.then(function (heads) {
        if (!heads[target]) {
            branches = Object.keys(heads);
            throw createError('Branch "' + target + '" does not exist', 'ENORESTARGET', {
                details: !branches.length ?
                    'No branches found in "' + this._source + '"' :
                    'Available branches in "' + this._source + '" are: ' + branches.join(', ')
            });
        }

        return { type: 'branch', branch: target, commit: heads[target] };
    }.bind(this));
};

// ------------------------------

// Abstract function, should be implemented by concrete git resolvers
GitResolver.fetchRefs = function (source) {};

// ------------------------------

GitResolver.fetchVersions = function (source) {
    if (this._versions && this._versions[source]) {
        return Q.resolve(this._versions[source]);
    }

    return this.fetchRefs(source)
    .then(function (refs) {
        var versions = [];

        // Parse each ref line, extracting the tag
        refs.forEach(function (line) {
            var match = line.match(/^[a-f0-9]{40}\s+refs\/tags\/(\S+)/),
                cleaned;

            // Ensure it's valid
            if (match) {
                cleaned = semver.clean(match[1]);
                if (cleaned) {
                    versions.push(cleaned);
                }
            }
        });

        // Sort them by desc order
        versions = versions.sort(function (a, b) {
            return semver.gt(a, b) ? -1 : 1;
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

        // Foreach line in the refs, extract only the heads
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
