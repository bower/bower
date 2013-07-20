var util = require('util');
var path = require('path');
var fs = require('graceful-fs');
var Q = require('q');
var mout = require('mout');
var request = require('request');
var progress = require('request-progress');
var replay = require('request-replay');
var GitRemoteResolver = require('./GitRemoteResolver');
var extract = require('../../util/extract');

function GitHubResolver(decEndpoint, config, logger) {
    var split;

    GitRemoteResolver.call(this, decEndpoint, config, logger);

    // Grab the org/repo
    split = this._source.split('/');
    this._org = split[split.length - 2];
    this._repo = split[split.length - 1];

    // Remote .git part form the end of the repo
    if (mout.string.endsWith(this._repo, '.git')) {
        this._repo = this._repo.substr(0, this._repo.length - 4);
    }
}

util.inherits(GitHubResolver, GitRemoteResolver);
mout.object.mixIn(GitHubResolver, GitRemoteResolver);

// -----------------

GitHubResolver.prototype._checkout = function () {
    // Only works with tags
    if (!this._resolution.tag) {
        return GitRemoteResolver.prototype._checkout.call(this);
    }

    var tarballUrl = 'http://github.com/' + this._org + '/' + this._repo + '/archive/' + this._resolution.tag + '.tar.gz';
    var file = path.join(this._tempDir, 'archive.tar.gz');
    var reqHeaders = {};
    var that = this;
    var deferred = Q.defer();

    if (this._config.userAgent) {
        reqHeaders['User-Agent'] = this._config.userAgent;
    }

    this._logger.action('download', tarballUrl, {
        url: that._source,
        to: file
    });

    // Download the tarball
    replay(progress(request(tarballUrl, {
        proxy: this._config.proxy,
        strictSSL: this._config.strictSsl,
        timeout: this._config.timeout,
        headers: reqHeaders
    })), {
        delay: 8000
    })
    .on('progress', function (state) {
        var totalMb = Math.round(state.total / 1024 / 1024);
        var receivedMb = Math.round(state.received / 1024 / 1024);

        that._logger.info('progress', receivedMb + 'MB of ' + totalMb + 'MB downloaded, ' + state.percent + '%');
    })
    .on('error', deferred.reject)
    // Pipe read stream to write stream
    .pipe(fs.createWriteStream(file))
    .on('error', deferred.reject)
    .on('close', function () {
        // Extract archive
        that._logger.action('extract', path.basename(file), {
            archive: file,
            to: that._tempDir
        });

        extract(file, that._tempDir)
        .then(deferred.resolve, deferred.reject);
    });

    return deferred.promise;
};

module.exports = GitHubResolver;
