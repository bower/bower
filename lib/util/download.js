var progress = require('request-progress');
var request = require('request');
var Q = require('q');
var mout = require('mout');
var retry = require('retry');
var createError = require('./createError');
var createWriteStream = require('fs-write-stream-atomic');

var errorCodes = [
    'EADDRINFO',
    'ETIMEDOUT',
    'ECONNRESET',
    'ESOCKETTIMEDOUT'
];

function download(url, file, options) {
    var operation;
    var deferred = Q.defer();
    var progressDelay = 8000;

    options = mout.object.mixIn({
        retries: 5,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 35000,
        randomize: true
    }, options || {});

    // Retry on network errors
    operation = retry.operation(options);

    operation.attempt(function () {
        Q.fcall(fetch, url, file, {
            progressDelay: progressDelay
        }).then(function(response) {
            deferred.resolve(response);
        }).fail(function (error) {
            // Save timeout before retrying to report
            var timeout = operation._timeouts[0];

            // Reject if error is not a network error
            if (errorCodes.indexOf(error.code) === -1) {
                return deferred.reject(error);
            }

            // Next attempt will start reporting download progress immediately
            progressDelay = 0;

            deferred.notify({
                retry: true,
                delay: timeout,
                error: error
            });

            operation.retry(error);
        });
    });

    return deferred.promise;
}

function fetch(url, file, options) {
    var response;
    var deferred = Q.defer();

    // Retry on network errors
    var req;
    var writeStream;
    var contentLength;
    var bytesDownloaded = 0;

    req = progress(request(url, options), {
        delay: options.progressDelay
    })
    .on('response', function (res) {
        var status = res.statusCode;

        if (status < 200 || status >= 300) {
            return deferred.reject(createError('Status code of ' + status, 'EHTTP'));
        }

        response = res;
        contentLength = Number(res.headers['content-length']);
    })
    .on('data', function (data) {
        bytesDownloaded += data.length;
    })
    .on('progress', function (state) {
        deferred.notify(state);
    })
    .on('error', function (error) {
        deferred.reject(error);
    })
    .on('end', function () {
        // Check if the whole file was downloaded
        // In some unstable connections the ACK/FIN packet might be sent in the
        // middle of the download
        // See: https://github.com/joyent/node/issues/6143
        if (contentLength && bytesDownloaded < contentLength) {
            req.emit('error', createError(
                'Transfer closed with ' + (contentLength - bytesDownloaded) + ' bytes remaining to read',
                'EINCOMPLETE'
            ));
        }
    });

    writeStream = createWriteStream(file);

    // Pipe read stream to write stream
    writeStream.on('error', function (error) {
        writeStream.destroy();
        deferred.reject(error);
    });

    writeStream.on('finish', function () {
        deferred.resolve(response);
    });

    req.pipe(writeStream);

    return deferred.promise;
}

module.exports = download;
