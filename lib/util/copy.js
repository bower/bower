var fstream = require('fstream');
var fstreamIgnore = require('fstream-ignore');
var fs = require('fs');
var Q = require('q');

function copy(reader, writer) {
    var deferred = Q.defer();
    var ignore;
    var finish;

    finish = function (err) {
        // Ensure that all listeners are removed
        writer.removeAllListeners();
        reader.removeAllListeners();

        // If we got an error, simply reject the deferred
        // Otherwise resolve it
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve();
        }
    };

    // Reader
    if (reader.type === 'Directory' && reader.ignore) {
        ignore = reader.ignore;
        reader = fstreamIgnore(reader);
        reader.addIgnoreRules(ignore);
    } else {
        reader = fstream.Reader(reader);
    }

    reader
    .on('error', finish);

    // Writer
    writer = fstream.Writer(writer)
    .on('error', finish)
    .on('close', finish);

    // Finally pipe reader to writer
    reader.pipe(writer);

    return deferred.promise;
}

function copyMode(src, dst) {
    return Q.nfcall(fs.stat, src)
    .then(function (stat) {
        return Q.nfcall(fs.chmod, dst, stat.mode);
    });
}

function parseOptions(opts) {
    opts = opts || {};

    if (opts.mode != null) {
        opts.copyMode = false;
    } else if (opts.copyMode == null) {
        opts.copyMode = true;
    }

    return opts;
}

// ---------------------

// Available options:
// - mode: force final mode of dest (defaults to null)
// - copyMode: copy mode of src to dest, only if mode is not specified (defaults to true)
function copyFile(src, dst, opts) {
    var promise;

    opts = parseOptions(opts);

    promise = copy({
        path: src,
        type: 'File'
    }, {
        path: dst,
        mode: opts.mode,
        type: 'File'
    });

    if (opts.copyMode) {
        promise = promise.then(copyMode.bind(copyMode, src, dst));
    }

    return promise;
}

// Available options:
// - ignore: array of patterns to be ignored (defaults to null)
// - mode: force final mode of dest (defaults to null)
// - copyMode: copy mode of src to dest, only if mode is not specified (defaults to true)
function copyDir(src, dst, opts) {
    var promise;

    opts = parseOptions(opts);

    promise = copy({
        path: src,
        type: 'Directory',
        ignore: opts.ignore
    }, {
        path: dst,
        mode: opts.mode,
        type: 'Directory'
    });

    if (opts.copyMode) {
        promise = promise.then(copyMode.bind(copyMode, src, dst));
    }

    return promise;
}

module.exports.copyDir = copyDir;
module.exports.copyFile = copyFile;
