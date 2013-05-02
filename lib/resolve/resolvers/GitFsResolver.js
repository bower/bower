var util = require('util');
var Q = require('q');
var mout = require('mout');
var GitResolver = require('./GitResolver');
var copy = require('../../util/copy');
var cmd = require('../../util/cmd');
var path = require('path');

var GitFsResolver = function (source, options) {
    // Ensure absolute path
    source = path.resolve(source);

    GitResolver.call(this, source, options);
};

util.inherits(GitFsResolver, GitResolver);
mout.object.mixIn(GitFsResolver, GitResolver);

// -----------------

GitFsResolver.prototype._copy = function () {
    return copy.copyDir(this._source, this._tempDir);
};

// Override the checkout function to work with the local copy
GitFsResolver.prototype._checkout = function () {
    var resolution = this._resolution;

    // The checkout process could be similar to the GitRemoteResolver by prepending file:// to the source
    // But from my performance measures, it's faster to copy the folder and just checkout in there

    // Copy files to the temporary directory first
    return this._copy()
    .then(cmd.bind(cmd, 'git', ['checkout', '-f', resolution.tag || resolution.branch || resolution.commit], { cwd: this._tempDir }))
    // Cleanup unstaged files
    .then(cmd.bind(cmd, 'git', ['clean', '-f', '-d'], { cwd: this._tempDir }));
};

// -----------------

// Grab refs locally
GitFsResolver.fetchRefs = function (source) {
    var cache;

    this._refs = this._refs  || {};

    cache =  this._refs[source];
    if (cache) {
        // If cached value is a promise, simply return it
        // This is to avoid duplicate fetches for the same source
        if (cache.then) {
            return cache;
        }

        // Otherwise, the cached value is already the refs,
        // resolve it
        return Q.resolve(cache);
    }

    // Store the promise in the refs object
    return this._refs[source] = cmd('git', ['show-ref', '--tags', '--heads'], { cwd : source })
    .then(function (stdout) {
        // Make them an array
        var refs = stdout.toString()
        .trim()                         // Trim trailing and leading spaces
        .replace(/[\t ]+/g, ' ')        // Standardize spaces (some git versions make tabs, other spaces)
        .split(/\r?\n/);                // Split lines into an array

        // Update the refs with the actual refs
        return this._refs[source] = refs;
    }.bind(this));
};

module.exports = GitFsResolver;
