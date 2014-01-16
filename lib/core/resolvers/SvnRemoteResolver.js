var util = require('util');
var mout = require('mout');
var SvnResolver = require('./SvnResolver');
var cmd = require('../../util/cmd');

function SvnRemoteResolver(decEndpoint, config, logger) {
    SvnResolver.call(this, decEndpoint, config, logger);

    if (!mout.string.startsWith(this._source, 'http://')) {
        // force use http urls
        this._source = this._source.replace('svn://', 'http://');

        // Trim trailing slashes
        this._source = this._source.replace(/\/+$/, '');
    }
}

util.inherits(SvnRemoteResolver, SvnResolver);
mout.object.mixIn(SvnRemoteResolver, SvnResolver);

SvnRemoteResolver.prototype._checkout = function () {
    var promise;
    var timer;
    var reporter;
    var that = this;
    var resolution = this._resolution;
    var info = resolution.type;

    if (resolution.type !== 'trunk') {
        info += ' ' +  resolution.tag || resolution.branch || resolution.commit;
    }

    this._logger.action('checkout', info, {
        resolution: resolution,
        to: this._tempDir
    });

    if (resolution.type === 'revision') {
        promise = cmd('svn', ['checkout', '-r ' + resolution.commit, this._source, this._tempDir]);
    } else if (resolution.type === 'trunk') {
        promise = cmd('svn', ['checkout', this._source + '/trunk', this._tempDir]);
    } else {
        promise = cmd('svn', ['checkout', this._source + '/' + resolution.type + 's/' + (resolution.tag || resolution.branch), this._tempDir]);
    }

    // Throttle the progress reporter to 1 time each sec
    reporter = mout.fn.throttle(function (data) {
        var lines;

        lines = data.split(/[\r\n]+/);
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
    // Add additional proxy information to the error if necessary
    .fail(function (err) {
        throw err;
    })
    // Clear timer at the end
    .fin(function () {
        clearTimeout(timer);
        reporter.cancel();
    });
};

SvnRemoteResolver.prototype._findResolution = function (target) {
    // Override this function to include a meaningful message related to proxies
    // if necessary
    return SvnResolver.prototype._findResolution.call(this, target)
    .fail(function (err) {
        throw err;
    });
};

module.exports = SvnRemoteResolver;
