var progress = require('request-progress');
var request = require('request');
var Q = require('q');
var mout = require('mout');
var retry = require('retry');
var createError = require('./createError');
var createWriteStream = require('fs-write-stream-atomic');
var destroy = require('destroy');

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
        randomize: true,
        progressDelay: progressDelay
    }, options || {});

    // Retry on network errors
    operation = retry.operation(options);

    operation.attempt(function () {
        Q.fcall(fetch, url, file, options)
        .then(function(response) {
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
            return req.emit('error', (createError('Status code of ' + status, 'EHTTP')));
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
        writeStream.emit('error', error);
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

    writeStream.on('error', function (error) {
        if (req) destroy(req);
        if (writeStream) destroy(writeStream);

        // For some reason we need to wait on Windows for streams to be closed..
        // TODO: Debug this and remove timeout
        setTimeout(function () {
            deferred.reject(error);
        }, 10);
    });

    writeStream.on('finish', function () {
        if (req) destroy(req);
        if (writeStream) destroy(writeStream);

        // For some reason we need to wait on Windows for streams to be closed..
        // TODO: Debug this and remove timeout
        setTimeout(function () {
            deferred.resolve(response);
        }, 10);
    });

    // Pipe read stream to write stream
    req.pipe(writeStream);

    return deferred.promise;

}

module.exports = download;