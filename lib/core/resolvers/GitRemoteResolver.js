var util = require('util');
var Q = require('q');
var mout = require('mout');
var GitResolver = require('./GitResolver');
var cmd = require('../../util/cmd');

function GitRemoteResolver(decEndpoint, config, logger) {
    if (!mout.string.startsWith(decEndpoint.source, 'file://')) {
        // Trim trailing slashes
        decEndpoint.source = decEndpoint.source.replace(/\/+$/, '');

        // Ensure trailing .git
        if (!mout.string.endsWith(decEndpoint.source, '.git')) {
            decEndpoint.source += '.git';
        }
    }

    GitResolver.call(this, decEndpoint, config, logger);

    // If the name was guessed, remove the trailing .git
    if (this._guessedName && mout.string.endsWith(this._name, '.git')) {
        this._name = this._name.slice(0, -4);
    }
}

util.inherits(GitRemoteResolver, GitResolver);
mout.object.mixIn(GitRemoteResolver, GitResolver);

// -----------------

GitRemoteResolver.prototype._checkout = function () {
    var branch;
    var promise;
    var timer;
    var that = this;
    var resolution = this._resolution;

    this._logger.action('checkout', resolution.tag || resolution.branch || resolution.commit, {
        resolution: resolution,
        to: this._tempDir
    });

    // If resolution is a commit, we need to clone the entire repo and check it out
    // Because a commit is not a named ref, there's no better solution
    if (resolution.type === 'commit') {
        promise = cmd('git', ['clone', this._source, this._tempDir, '--progress'])
        .then(cmd.bind(cmd, 'git', ['checkout', resolution.commit], { cwd: this._tempDir }));
    // Otherwise we are checking out a named ref so we can optimize it
    } else {
        branch = resolution.tag || resolution.branch;
        promise = cmd('git', ['clone',  this._source, '-b', branch, '--depth', 1, '--progress', '.'], { cwd: this._tempDir });
    }

    // Start reporting progress after 8 seconds
    timer = setTimeout(function () {
        promise.progress(function (data) {
            var lines = data.split(/\r?\n/);

            lines.forEach(function (line) {
                if (/\d{1,3}\%/.test(line)) {
                    that._logger.info('progress', data);
                }
            });
        });
    }, 8000);

    return promise
    // Clear timer at the end
    .fin(function () {
        clearTimeout(timer);
    });
};

// ------------------------------

// Grab refs remotely
GitRemoteResolver.refs = function (source) {
    var value;

    // TODO: Normalize source because of the various available protocols?
    value = this._cache.refs.get(source);
    if (value) {
        return Q.resolve(value);
    }

    // Store the promise in the refs object
    value = cmd('git', ['ls-remote', '--tags', '--heads', source])
    .then(function (stdout) {
        var refs;

        refs = stdout.toString()
        .trim()                         // Trim trailing and leading spaces
        .replace(/[\t ]+/g, ' ')        // Standardize spaces (some git versions make tabs, other spaces)
        .split(/\r?\n/);                // Split lines into an array

        // Update the refs with the actual refs
        this._cache.refs.set(source, refs);

        return refs;
    }.bind(this));

    // Store the promise to be reused until it resolves
    // to a specific value
    this._cache.refs.set(source);

    return value;
};

module.exports = GitRemoteResolver;
