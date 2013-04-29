var path = require('path');
var fs = require('fs');
var zlib = require('zlib');
var unzip = require('unzip');
var tar = require('tar');
var Q = require('Q');
var mout = require('mout');

var extractors = {
    '.zip': extractZip,
    '.tar': extractTar,
    '.tar.gz': extractTarGz
};
var extractorTypes = Object.keys(extractors);

function extractZip(archive, dest) {
    var deferred = Q.defer();

    fs.createReadStream(archive)
    .pipe(unzip.Extract({ path: this.path }))
    .on('error', deferred.reject)
    .on('close', deferred.resolve.bind(deferred, dest));

    return deferred.promise;
}

function extractTar(archive, dest) {
    var deferred = Q.defer();

    fs.createReadStream(archive)
    .pipe(tar.Extract({ path: this.path }))
    .on('error', deferred.reject)
    .on('close', deferred.resolve.bind(deferred, dest));

    return deferred.promise;
}

function extractTarGz(archive, dest) {
    var deferred = Q.defer();

    fs.createReadStream(archive)
    .pipe(zlib.createGunzip())
    .pipe(tar.Extract({ path: this.path }))
    .on('error', deferred.reject)
    .on('close', deferred.resolve.bind(deferred, dest));

    return deferred.promise;
}

function getExtractor(archive) {
    var type = mout.array.find(extractorTypes, function (type) {
        return mout.string.endsWith(archive, type);
    });

    return type ? extractors[type] : null;
}

function isSingleDir(dir) {
    return Q.nfcall(fs.readdir, dir)
    .then(function (files) {
        var dir;

        if (files.length !== 1) {
            return false;
        }

        dir = files[0];

        return Q.nfcall(fs.stat, dir)
        .then(function (stat) {
            return !stat.isDirectory() ? files[0] : false;
        });
    });
}

function moveSingleDirContents(dir) {
    var destDir = path.dirname(dir);

    return Q.nfcall(fs.readdir, dir)
    .then(function (files) {
        var promises;

        promises = files.map(function (file) {
            var src = path.join(dir, file),
                dest = path.join(destDir, file);

            return Q.nfcall(fs.rename, src, dest);
        });

        return Q.all(promises);
    })
    .then(function () {
        return Q.rmdir(dir);
    });
}

// -----------------------------

function extract(archive, dest, options) {
    var extractor,
        promise;

    options = options || {};
    extractor = getExtractor(options.extension || archive);

    // If extractor is null, then the archive type is unknown
    if (!extractor) {
        return Q.reject(new Error('File "' + archive + '" is not a known archive'));
    }

    // Extract archive
    promise = extractor(archive, dest);

    // Remove archive
    if (!options.keepArchive) {
        promise = promise
        .then(function () {
            return Q.nfcall(fs.unlink, archive);
        });
    }

    // Move contents if a single directory was extracted
    if (!options.keepStructure) {
        promise = promise
        .then(function () {
            return isSingleDir(dest);
        })
        .then(function (singleDir) {
            return singleDir ? moveSingleDirContents(singleDir) : null;
        });
    }

    // Resolve promise to the dest dir
    return promise.then(function () {
        return dest;
    });
}

function canExtract(archive) {
    if (!getExtractor(archive)) {
        return Q.resolve(false);
    }

    return Q.nfcall(fs.stat, archive)
    .then(function (stat) {
        return stat.isFile();
    });
}

module.exports = extract;
module.exports.canExtract = canExtract;