var util = require('util');
var Q = require('q');
var semver = require('semver');
var mout = require('mout');
var Resolver = require('./Resolver');
var cmd = require('../../util/cmd');
var createError = require('../../util/createError');

var GitRemoteResolver = function (source, options) {
    Resolver.call(this, source, options);
};

util.inherits(GitRemoteResolver, Resolver);

// -----------------

GitRemoteResolver.prototype.hasNew = function (oldTarget, oldResolution) {
    return this._resolveTarget(this._target)
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

GitRemoteResolver.prototype._resolveSelf = function () {
    var promise;

    promise = this._resolveTarget()
    .then(this._checkout.bind(this));

    return promise;
};

GitRemoteResolver.prototype._resolveTarget = function () {
    var target = this._target,
        source = this._source,
        promise,
        branches,
        errorMessage,
        errorDetails;

    // Target is a range/version
    if (semver.valid(target) || semver.validRange(target)) {
        return GitRemoteResolver._fetchVersions(this._source)
        .then(function (versions) {
            // Find the highest one that satifies the target
            var version = mout.array.find(versions, function (version) {
                return semver.satisfies(version, target);
            });

            if (!version) {
                errorMessage = !semver.validRange(target) ?
                    'Tag "' + target + '" does not exist' :
                    'No tag found that was able to satisfy "' + target + '"';
                errorDetails = !versions.length ?
                    'No tags found in "' + source + '"' :
                    'Available tags in "' + source + '" are: ' + versions.join(', ');
                throw createError(errorMessage, 'ENORESTARGET', errorDetails);
            }

            return { type: 'tag', tag: version };
        });
    }

    // Resolve the rest to a commit version
    promise = GitRemoteResolver._fetchHeads(this._source);

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
            errorDetails = !branches.length ?
                'No branches found in "' + source + '"' :
                'Available branches in "' + source + '" are ' + branches.join(', ');

            throw createError('Branch "' + target + '" does not exist', 'ENORESTARGET', errorDetails);
        }

        return { type: 'branch', branch: target, commit: heads[target] };
    });
};

GitRemoteResolver.prototype._checkout = function (resolution) {
    var dir = this._tempDir,
        branch;

    console.log(resolution);
    if (resolution.type === 'commit') {
        return Q.nfcall(cmd, 'git', ['clone', this._source, dir])
        .then(function () {
            return Q.nfcall(cmd, 'git', ['checkout', resolution.commit], { cwd: dir });
        });
    } else {
        branch = resolution.tag || resolution.branch;
        return Q.nfcall(cmd, 'git', ['clone',  this._source, '-b', branch, '--depth', 1], { cwd: dir });
    }
};

// ------------------------------

GitRemoteResolver._fetchRefs = function (source) {
    if (this._refs && this._refs[source]) {
        return Q.resolve(this._refs[source]);
    }

    return Q.nfcall(cmd, 'git', ['ls-remote', '--tags', '--heads', source])
    .then(function (stdout) {
        // Make them an array
        var refs = stdout.toString().split('\n');

        this._refs = this._refs  || {};
        return this._refs[source] = refs;
    }.bind(this));
};

GitRemoteResolver._fetchVersions = function (source) {
    if (this._versions && this._versions[source]) {
        return Q.resolve(this._versions[source]);
    }

    return this._fetchRefs(source)
    .then(function (refs) {
        var versions = [];

        // Parse each ref line, extracting the tag
        refs.forEach(function (line) {
            var match = line.match(/^[a-f0-9]{40}\s+refs\/tags\/(\S+)$/),
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

GitRemoteResolver._fetchHeads = function (source) {
    if (this._heads && this._heads[source]) {
        return Q.resolve(this._heads[source]);
    }

    // Request heads of the source of only the specified branch
    return  this._fetchRefs(source)
    .then(function (refs) {
        this._heads = this._heads || {};
        var heads = this._heads[source] = this._heads[source] || {};

        // Foreach line in the refs, extract only the heads
        // Organize them in an object where keys are branches and values
        // the commit hash
        mout.array.forEach(refs, function (line) {
            var match = line.match(/^([a-f0-9]{40})\s+refs\/heads\/(\S+)$/);

            if (match) {
                heads[match[2]] = match[1];
            }
        });


        return heads;
    }.bind(this));
};

module.exports = GitRemoteResolver;
