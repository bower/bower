var util = require('util');
var path = require('path');
var mout = require('mout');
var GitRemoteResolver = require('./GitRemoteResolver');
var download = require('../../util/download');
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
    // Only fully works with public repositories and tags
    // Could work with https/ssh protocol but not with 100% certainty
    if (!this._public || !this._resolution.tag) {
        return GitRemoteResolver.prototype._checkout.call(this);
    }

    var tarballUrl = 'http://github.com/' + this._org + '/' + this._repo + '/archive/' + this._resolution.tag + '.tar.gz';
    var file = path.join(this._tempDir, 'archive.tar.gz');
    var reqHeaders = {};
    var that = this;

    if (this._config.userAgent) {
        reqHeaders['User-Agent'] = this._config.userAgent;
    }

    this._logger.action('download', tarballUrl, {
        url: that._source,
        to: file
    });

    // Download tarball
    return download(tarballUrl, file, {
        proxy: this._config.proxy,
        strictSSL: this._config.strictSsl,
        timeout: this._config.timeout,
        headers: reqHeaders
    })
    .progress(function (state) {
        var msg;

        // Retry?
        if (state.retry) {
            msg = 'Download of ' + tarballUrl + ' failed with ' + state.error.code + ', ';
            msg += 'retrying in ' + (state.delay / 1000).toFixed(1) + 's';
            return that._logger.warn('retry', msg);
        }

        // Progress
        msg = 'received ' + (state.received / 1024 / 1024).toFixed(1) + 'MB ';
        msg += 'of ' + (state.total / 1024 / 1024).toFixed(1) + 'MB downloaded, ',
        msg += state.percent + '%';
        that._logger.info('progress', msg);
    })
    .then(function () {
        // Extract archive
        that._logger.action('extract', path.basename(file), {
            archive: file,
            to: that._tempDir
        });

        return extract(file, that._tempDir);
    });
};

GitHubResolver.prototype._savePkgMeta = function (meta) {
    // Set homepage if not defined
    if (!meta.homepage) {
        meta.homepage = 'https://github.com/' + this._org + '/' + this._repo;
    }

    return GitRemoteResolver.prototype._savePkgMeta.call(this, meta);
};

module.exports = GitHubResolver;
