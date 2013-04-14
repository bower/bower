var util = require('util');
var Q = require('q');
var mout = require('mout');
var GitResolver = require('./GitResolver');
var cmd = require('../../util/cmd');

var GitRemoteResolver = function (source, options) {
    GitResolver.call(this, source, options);
};

util.inherits(GitRemoteResolver, GitResolver);
mout.object.mixIn(GitRemoteResolver, GitResolver);

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

// Grab refs remotely
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

module.exports = GitRemoteResolver;
