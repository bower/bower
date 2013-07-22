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
var createError = require('../../util/createError');

function GitHubResolver(decEndpoint, config, logger) {
    var split;

    GitRemoteResolver.call(this, decEndpoint, config, logger);

    // Check if it's public
    this._public = mout.string.startsWith(this._source, 'git://');

    // Grab the org/repo
    split = this._source.split('/');
    this._org = split[split.length - 2];
    this._repo = split[split.length - 1];

    // Error out if no org or repo
    if (!this._org || !this._repo) {
        throw createError('Invalid GitHub URL', 'EINVEND', {
            details: this._source + ' seems not to be a GitHub valid URL'
        });
    }

    // Remote .git part form the end of the repo
    if (mout.string.endsWith(this._repo, '.git')) {
        this._repo = this._repo.substr(0, this._repo.length - 4);
    }
}

util.inherits(GitHubResolver, GitRemoteResolver);
mout.object.mixIn(GitHubResolver, GitRemoteResolver);

// -----------------

GitHubResolver.prototype._checkout = function () {
    // Only works with public repositories and tags
    // TODO: Actually it might work with non-public repos since ssh & https protocols
    //       can also reference public repositories
    //       As such, we could proceed and detect 404 status code but..
    if (!this._public || !this._resolution.tag) {
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
    }), {
        delay: 8000
    }))
    .on('progress', function (state) {
        var totalMb = Math.round(state.total / 1024 / 1024);
        var receivedMb = Math.round(state.received / 1024 / 1024);

        that._logger.info('progress', receivedMb + 'MB of ' + totalMb + 'MB downloaded, ' + state.percent + '%');
    })
    .on('replay', function (nr, error) {
        that._logger.debug('retry', 'Retrying request to ' + tarballUrl + ' because it failed with ' + error.code);
    })
    .on('response', function (response) {
        var status = response.statusCode;

        if (status < 200 || status > 300) {
            deferred.reject(createError('Status code of ' + status, 'EHTTP'));
        }
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

GitHubResolver.prototype._savePkgMeta = function (meta) {
    // Set homepage if not defined
    if (!meta.homepage) {
        meta.homepage = 'https://github.com/' + this._org + '/' + this._repo;
    }

    return GitRemoteResolver.prototype._savePkgMeta.call(this, meta);
};

module.exports = GitHubResolver;
