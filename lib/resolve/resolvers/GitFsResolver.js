var util = require('util');
var fs = require('fs');
var Q = require('q');
var mout = require('mout');
var ncp = require('ncp');
var GitRemoteResolver = require('./GitRemoteResolver');
var cmd = require('../../util/cmd');

var GitFsResolver = function (endpoint, options) {
    GitRemoteResolver.call(this, endpoint, options);
};

util.inherits(GitFsResolver, GitRemoteResolver);

// -----------------

GitFsResolver.prototype._resolveSelf = function () {
    var self = this.constructor;

    return this._copy()
    .then(this._fetch.bind(this))
    .then(self.findResolution.bind(self, this._tempDir, this._target))
    .then(this._checkout.bind(this));
};

// -----------------

GitFsResolver.prototype._copy = function () {
    var tempDir = this._tempDir;

    // Copy folder permissions
    return Q.nfcall(fs.stat, this._source)
    .then(function (stat) {
        return Q.nfcall(fs.chmod, tempDir, stat.mode);
    })
    // Copy folder contents
    .then(function () {
        return Q.nfcall(ncp, this._source, tempDir);
    });
};

GitFsResolver.prototype._fetch = function () {
    var dir = this._tempDir;

    // Check if there is at least one remote
    cmd('git', ['remote'], { cwd: dir })
    .then(function (stdout) {
        var hasRemote = !!stdout.trim().length;

        // If so, do a fetch to grab the new tags and refs
        if (hasRemote) {
            return cmd('git', ['fetch', '--prune']);
        }
    });
};

// Override the checkout function to work with the local copy
GitFsResolver.prototype._checkout = function (resolution) {
    var dir = this._tempDir;

    console.log(resolution);

    // Checkout resolution
    cmd('git', ['checkout', '-f', resolution.tag || resolution.branch || resolution.commit], { cwd: dir })
    // Cleanup unstagged files
    .then(function () {
        return cmd('git', ['clean', '-f', '-d'], { cwd: dir });
    });
};

// -----------------

// Copy static stuff
mout.object.mixIn(GitFsResolver, GitRemoteResolver);

// Override the fetch refs to grab them locally
GitFsResolver.fetchRefs = function (source) {
    if (this._refs && this._refs[source]) {
        return Q.resolve(this._refs[source]);
    }

    return cmd('git', ['show-ref', '--tags', '--heads'], { cwd : source })
    .then(function (stdout) {
        // Make them an array
        var refs = stdout.toString().split('\n');

        this._refs = this._refs  || {};
        return this._refs[source] = refs;
    }.bind(this));
};

module.exports = GitFsResolver;
