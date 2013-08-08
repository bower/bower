var util = require('util');
var mout = require('mout');
var GitRemoteResolver = require('./GitRemoteResolver');
var GitResolver = require('./GitResolver');
var cmd = require('../../util/cmd');

function GitGoogleResolver(decEndpoint, config, logger) {
    GitResolver.call(this, decEndpoint, config, logger);
}

util.inherits(GitGoogleResolver, GitRemoteResolver);
mout.object.mixIn(GitGoogleResolver, GitRemoteResolver);

// -----------------

GitGoogleResolver.prototype._checkout = function () {
    var branch;
    var promise;
    var timer;
    var reporter;
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
        promise = cmd('git', ['clone',  this._source, '-b', branch, '--progress', '.'], { cwd: this._tempDir })
        .spread(function (stdout, stderr) {
            // Only after 1.7.10 --branch accepts tags
            // Detect those cases and inform the user to update git otherwise it's
            // a lot slower than newer versions
            if (!/branch .+? not found/i.test(stderr)) {
                return;
            }

            that._logger.warn('old-git', 'It seems you are using an old version of git, it will be slower and propitious to errors!');
            return cmd('git', ['checkout', resolution.commit], { cwd: that._tempDir });
        });
    }

    // Throttle the progress reporter to 1 time each sec
    reporter = mout['function'].throttle(function (data) {
        var lines = data.split(/[\r\n]+/);

        lines.forEach(function (line) {
            if (/\d{1,3}\%/.test(line)) {
                // TODO: There are some strange chars that appear once in a while (\u001b[K)
                //       Trim also those?
                that._logger.info('progress', line.trim());
            }
        });
    }, 1000);

    // Start reporting progress after a few seconds
    timer = setTimeout(function () {
        promise.progress(reporter);
    }, 8000);

    return promise
    // Clear timer at the end
    .fin(function () {
        clearTimeout(timer);
    });
};

module.exports = GitGoogleResolver;
