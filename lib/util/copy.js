var fstream = require('fstream');
var Q = require('Q');

// Simple function to copy files and folders
// It uses the awesome fstream library.
// The "options.reader" will be passed to the reader.
// The "options.writter" will be passed to the writter.
function copy(src, dst, opts) {
    opts = opts || {};

    var deferred = Q.defer(),
        reader,
        writter,
        removeListeners;

    // Simple function to remove all the listeners
    removeListeners = function () {
        reader.removeAllListeners();
        writter.removeAllListeners();
    };

    // TODO: see isacs reply about the end and error events..

    // Create writter
    opts.writter = opts.writter || {};
    opts.writter.path = dst;

    opts.writter.type = 'Directory';
    writter = fstream.Writer(opts.writter)
    .on('error', function (err) {
        removeListeners();
        deferred.reject(err);
    })
    .on('close', function () {
        removeListeners();
        deferred.resolve();
    });

    // Create reader
    opts.reader = opts.reader || {};
    opts.reader.path = src;

    reader = fstream.Reader(opts.reader)
    .on('error', function (err) {
        removeListeners();
        deferred.reject(err);
    });

    // Pipe reader to writter
    reader.pipe(writter);

    return deferred.promise;
}

module.exports = copy;