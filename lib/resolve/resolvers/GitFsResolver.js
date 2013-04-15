var util = require('util');
var fs = require('fs');
var Q = require('q');
var mout = require('mout');
var ncp = require('ncp');
var GitResolver = require('./GitResolver');
var cmd = require('../../util/cmd');
var path = require('path');

var GitFsResolver = function (source, options) {
    // Ensure absolute path
    // TODO: should sources that arrive here be already absolute
    //       or is ok to do this here?
    source = path.resolve(this._source);

    GitResolver.call(this, source, options);
};

util.inherits(GitFsResolver, GitResolver);
mout.object.mixIn(GitFsResolver, GitResolver);

// -----------------

GitFsResolver.prototype._resolveSelf = function () {
    return this._findResolution()
    .then(this._copy.bind(this))
    .then(function () {
        return this._checkout(this._resolution);
    }.bind(this));
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
    }.bind(this));
};

// Override the checkout function to work with the local copy
GitFsResolver.prototype._checkout = function (resolution) {
    var dir = this._tempDir;

    console.log(resolution);

    // Checkout resolution
    return cmd('git', ['checkout', '-f', resolution.tag || resolution.branch || resolution.commit], { cwd: dir })
    // Cleanup unstagged files
    .then(cmd.bind(cmd, 'git', ['clean', '-f', '-d'], { cwd: dir }));
};

// -----------------

// Grab refs locally
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
