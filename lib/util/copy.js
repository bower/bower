var fstream = require('fstream');
var fstreamIgnore = require('fstream-ignore');
var fs = require('fs');
var ncp = require('ncp');
var Q = require('q');

function copy(reader, writer) {
    var deferred;
    var ignore;

    // If there's no ignore, use ncp because it is much faster
    // than fstream
    if (reader.type !== 'Directory' || !reader.ignore) {
        return Q.nfcall(ncp, reader.path, writer.path)
        .then(function () {
            if (writer.mode) {
                return Q.nfcall(fs.chmod, writer.path, writer.mode);
            }
        });
    }

    deferred = Q.defer();
    ignore = reader.ignore;
    reader = fstreamIgnore(reader);
    reader.addIgnoreRules(ignore);

    reader
    .on('error', deferred.reject)
    // Pipe to writer
    .pipe(fstream.Writer(writer))
    .on('error', deferred.reject)
    .on('close', deferred.resolve);

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
