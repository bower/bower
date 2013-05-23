var util = require('util');
var Q = require('q');
var mout = require('mout');
var GitResolver = require('./GitResolver');
var cmd = require('../../util/cmd');

var GitRemoteResolver = function (source, options) {
    if (!mout.string.startsWith(source, 'file://')) {
        // Trim trailing slashes
        source = source.replace(/\/+$/, '');

        // Ensure trailing .git
        if (!mout.string.endsWith(source, '.git')) {
            source += '.git';
        }
    }

    GitResolver.call(this, source, options);

    // If the name was guessed, remove the trailing .git
    if (this._guessedName && mout.string.endsWith(this._name, '.git')) {
        this._name = this._name.slice(0, -4);
    }
};

util.inherits(GitRemoteResolver, GitResolver);
mout.object.mixIn(GitRemoteResolver, GitResolver);

// -----------------

GitRemoteResolver.prototype._checkout = function () {
    var branch;
    var promise;
    var resolution = this._resolution;
    var deferred = Q.defer();

    process.nextTick(function () {
        deferred.notify({
            level: 'action',
            tag: 'checkout',
            data: resolution.tag || resolution.branch || resolution.commit
        });
    });

    // If resolution is a commit, we need to clone the entire repo and check it out
    // Because a commit is not a named ref, there's no better solution
    if (resolution.type === 'commit') {
        promise = cmd('git', ['clone', this._source, this._tempDir])
        .then(cmd.bind(cmd, 'git', ['checkout', resolution.commit], { cwd: this._tempDir }));
    // Otherwise we are checking out a named ref so we can optimize it
    } else {
        branch = resolution.tag || resolution.branch;
        promise = cmd('git', ['clone',  this._source, '-b', branch, '--depth', 1, '.'], { cwd: this._tempDir });
    }

    promise
    .then(deferred.resolve, deferred.reject, deferred.notify);

    return deferred.promise;
};

// ------------------------------

// Grab refs remotely
GitRemoteResolver.fetchRefs = function (source) {
    var cache;

    // TODO: normalize source because of the various available protocols?
    this._refs = this._refs || {};

    cache = this._refs[source];
    if (cache) {
        // If cached value is a promise, simply return it
        // This avoids duplicate fetches for the same source
        if (cache.then) {
            return cache;
        }

        // Otherwise, the cached value is already the refs,
        // resolve it
        return Q.resolve(cache);
    }

    // Store the promise in the refs object
    return this._refs[source] = cmd('git', ['ls-remote', '--tags', '--heads', source])
    .then(function (stdout) {
        var refs;

        refs = stdout.toString()
        .trim()                         // Trim trailing and leading spaces
        .replace(/[\t ]+/g, ' ')        // Standardize spaces (some git versions make tabs, other spaces)
        .split(/\r?\n/);                // Split lines into an array

        // Update the refs with the actual refs
        return this._refs[source] = refs;
    }.bind(this));
};

module.exports = GitRemoteResolver;
