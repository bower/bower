var util = require('util');
var fs = require('fs');
var path = require('path');
var mout = require('mout');
var Q = require('q');
var Resolver = require('./Resolver');
var copy = require('../../util/copy');
var extract = require('../../util/extract');
var createError = require('../../util/createError');
var junk = require('junk');

function FsResolver(source, options) {
    Resolver.call(this, source, options);

    // Ensure absolute path
    this._source = path.resolve(this._config.cwd, source);

    // If target was specified, simply reject the promise
    if (this._target !== '*') {
        throw createError('File system sources can\'t resolve targets', 'ENORESTARGET');
    }
}

util.inherits(FsResolver, Resolver);
mout.object.mixIn(FsResolver, Resolver);

// -----------------

// TODO: should we store latest mtimes in the resolution and compare?
//       this would be beneficial when copying big files/folders

// TODO: there's room for improvement by using streams if the source
//       is an archive file, by piping read stream to the zip extractor
//       this will likely increase the complexity of code but might worth it
FsResolver.prototype._resolve = function () {
    return this._readJson(this._source)
    .then(this._copy.bind(this))
    .then(this._extract.bind(this))
    .then(this._rename.bind(this));
};

// -----------------

FsResolver.prototype._copy = function (meta) {
    var that = this;
    var deferred = Q.defer();

    process.nextTick(function () {
        deferred.notify({
            level: 'action',
            tag: 'copy',
            data: that._source,
            source: that._source
        });
    });

    Q.nfcall(fs.stat, this._source)
    .then(function (stat) {
        var dstFile;
        var copyOpts;
        var promise;

        that._sourceStat = stat;

        // Pass in the ignore to the copy options to avoid copying ignored files
        // Also, pass in the mode to avoid additional stat calls when copying
        copyOpts = {
            mode: stat.mode,
            ignore: meta.ignore
        };

        // If it's a folder
        if (stat.isDirectory()) {
            promise = copy.copyDir(that._source, that._tempDir, copyOpts);
        // Else it's a file
        } else {
            dstFile = path.join(that._tempDir, path.basename(that._source));
            promise = copy.copyFile(that._source, dstFile, copyOpts);
        }

        return promise.then(function () {
            return dstFile;
        });
    })
    .then(deferred.resolve, deferred.reject, deferred.notify);

    return deferred.promise;
};

FsResolver.prototype._extract = function (file) {
    var deferred;

    if (!file || !extract.canExtract(file)) {
        return Q.resolve();
    }

    deferred = Q.defer();

    process.nextTick(function () {
        deferred.notify({
            level: 'action',
            tag: 'copy',
            data: this._source,
            source: this._source
        });
    }.bind(this));

    extract(file, this._tempDir)
    .then(deferred.resolve, deferred.reject, deferred.notify);

    return deferred.promise;
};

FsResolver.prototype._rename = function () {
    return Q.nfcall(fs.readdir, this._tempDir)
    .then(function (files) {
        var file;
        var oldPath;
        var newPath;

        // Remove any OS specific files from the files array
        // before checking its length
        files = files.filter(junk.isnt);

        if (files.length === 1) {
            file = files[0];
            this._singleFile = 'index' + path.extname(file);
            oldPath = path.join(this._tempDir, file);
            newPath = path.join(this._tempDir, this._singleFile);

            return Q.nfcall(fs.rename, oldPath, newPath);
        }
    }.bind(this));
};

FsResolver.prototype._savePkgMeta = function (meta) {
    // Store main if is a single file
    if (this._singleFile) {
        meta.main = this._singleFile;
    }

    return Resolver.prototype._savePkgMeta.call(this, meta);
};

module.exports = FsResolver;
