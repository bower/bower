var util = require('util');
var path = require('path');
var fs = require('graceful-fs');
var Q = require('q');
var mout = require('mout');
var request = require('request');
var GitRemoteResolver = require('./GitRemoteResolver');
var extract = require('../../util/extract');

function GitHubResolver(decEndpoint, config, logger) {
    var split;

    GitRemoteResolver.call(this, decEndpoint, config, logger);

    // Grab the org/repo
    split = this._source.split('/');
    this._org = split[split.length - 2];
    this._repo = mout.string.rtrim(split[split.length - 1], '.git');
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
    request(tarballUrl, {
        proxy: this._config.proxy,
        strictSSL: this._config.strictSsl,
        timeout: 5000,
        headers: reqHeaders,
        agent: false                 // Do not use keep alive, solves #437
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
