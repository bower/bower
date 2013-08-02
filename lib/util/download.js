var progress = require('request-progress');
var request = require('request');
var Q = require('q');
var mout = require('mout');
var retry = require('retry');
var fs = require('graceful-fs');
var createError = require('./createError');

var errorCodes = [
    'EADDRINFO',
    'ETIMEDOUT',
    'ECONNRESET',
    'ESOCKETTIMEDOUT'
];

function download(url, file, logger, options) {
    var operation;
    var deferred = Q.defer();
    var response;

    options = mout.object.mixIn({
        retries: 5,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 35000
    }, options || {});

    // Retry on network errors
    operation = retry.operation(options);
    operation._timeouts[0] = 0;  // Force first immediately

    operation.attempt(function () {
        progress(request(url, options), {
            delay: 8000
        })
        .on('response', function (res) {
            var status = res.statusCode;

            if (status < 200 || status > 300) {
                return deferred.reject(createError('Status code of ' + status, 'EHTTP'));
            }

            response = res;
        })
        .on('progress', function (state) {
            var totalMb = Math.round(state.total / 1024 / 1024 * 10) / 10;
            var receivedMb = Math.round(state.received / 1024 / 1024 * 10) / 10;

            logger.info('progress', receivedMb + ' MB of ' + totalMb + ' MB downloaded, ' + state.percent + '%');
        })
        .on('error', function (error) {
            // Reject if error is not a network error
            if (errorCodes.indexOf(error.code) === -1) {
                return deferred.reject(error);
            }

            // Check if there are more retries
            if (operation.retry(error)) {
                return logger.warn('retry', 'Request to ' + url + ' failed with ' + error.code + ', retrying soon..');
            }

            // No more retries, reject!
            deferred.reject(error);
        })
        // Pipe read stream to write stream
        .pipe(fs.createWriteStream(file))
        .on('error', deferred.reject)
        .on('close', function () {
            deferred.resolve(response);
        });
    });

    return deferred.promise;
}

module.exports = download;
