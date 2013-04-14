var util = require('util');
var Q = require('q');
var semver = require('semver');
var mout = require('mout');
var Resolver = require('../Resolver');
var cmd = require('../../util/cmd');
var createError = require('../../util/createError');

var GitRemoteResolver = function (source, options) {
    Resolver.call(this, source, options);
};

util.inherits(GitRemoteResolver, Resolver);

// -----------------

GitRemoteResolver.prototype._resolveSelf = function () {
    return this.constructor.findResolution(this._source, this._target)
    .then(this._checkout.bind(this));
};

GitRemoteResolver.prototype.hasNew = function (oldTarget, oldResolution) {
    return this.constructor.findResolution(this._source, this._target)
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

// -----------------

GitRemoteResolver.prototype._checkout = function (resolution) {
    var dir = this._tempDir,
        branch;

    console.log(resolution);

    // If resolution is a commit, we need to clone the entire repo and checkit out
    // Because a commit is not a nammed ref, there's no better solution
    if (resolution.type === 'commit') {
        return cmd('git', ['clone', this._source, '.'], { cwd: dir })
        .then(function () {
            return cmd('git', ['checkout', resolution.commit], { cwd: dir });
        });
    // Otherwise we are checking out a named ref so we can optimize it
    } else {
        branch = resolution.tag || resolution.branch;
        return cmd('git', ['clone',  this._source, '-b', branch, '--depth', 1, '.'], { cwd: dir });
    }
};

// ------------------------------

GitRemoteResolver.findResolution = function (source, target) {
    var promise,
        branches;

    // Target is a range/version
    if (semver.valid(target) || semver.validRange(target)) {
        return this.fetchVersions(source)
        .then(function (versions) {
            // Find the highest one that satifies the target
            var version = mout.array.find(versions, function (version) {
                return semver.satisfies(version, target);
            });

            if (!version) {
                throw createError('No tag found that was able to satisfy "' + target + '"', 'ENORESTARGET', {
                    details: !versions.length ?
                        'No tags found in "' + source + '"' :
                        'Available tags in "' + source + '" are: ' + versions.join(', ')
                });
            }

            return { type: 'tag', tag: version };
        });
    }

    // Resolve the rest to a commit version
    promise = this.fetchHeads(source);

    // Target is a commit, so it's a stale target (not a moving target)
    // There's nothing to do in this case
    if ((/^[a-f0-9]{40}$/).test(target)) {
        return Q.resolve({ type: 'commit', commit: target });
    }

    // If target is *, use master branch
    if (target === '*') {
        target = 'master';
    }

    // Target is a branch
    return promise.then(function (heads) {
        if (!heads[target]) {
            branches = Object.keys(heads);
            throw createError('Branch "' + target + '" does not exist', 'ENORESTARGET', {
                details: !branches.length ?
                    'No branches found in "' + source + '"' :
                    'Available branches in "' + source + '" are: ' + branches.join(', ')
            });
        }

        return { type: 'branch', branch: target, commit: heads[target] };
    });
};

GitRemoteResolver.fetchRefs = function (source) {
    if (this._refs && this._refs[source]) {
        return Q.resolve(this._refs[source]);
    }

    return cmd('git', ['ls-remote', '--tags', '--heads', source])
    .then(function (stdout) {
        // Make them an array
        var refs = stdout.toString().split('\n');

        this._refs = this._refs  || {};
        return this._refs[source] = refs;
    }.bind(this));
};

GitRemoteResolver.fetchVersions = function (source) {
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

GitRemoteResolver.fetchHeads = function (source) {
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

module.exports = GitRemoteResolver;
