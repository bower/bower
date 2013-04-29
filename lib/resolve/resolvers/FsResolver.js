var util = require('util');
var fs = require('fs');
var path = require('path');
var mout = require('mout');
var Q = require('q');
var Resolver = require('../Resolver');
var copy = require('../../util/copy');
var extract = require('../../util/extract');
var createError = require('../../util/createError');

var FsResolver = function (source, options) {
    // Ensure absolute path
    source = path.resolve(source);

    Resolver.call(this, source, options);
};

util.inherits(FsResolver, Resolver);
mout.object.mixIn(FsResolver, Resolver);

// -----------------

FsResolver.prototype.hasNew = function (canonicalPkg) {
    // If target was specified, simply reject the promise
    if (this._target !== '*') {
        return Q.reject(createError('File system sources can\'t resolve targets ("' + this._target + '")', 'ENORESTARGET'));
    }

    // TODO: should we store latest modified files in the resolution and compare?
    return Q.resolve(true);
};

FsResolver.prototype._resolveSelf = function () {
    // If target was specified, simply reject the promise
    if (this._target !== '*') {
        return Q.reject(createError('File system sources can\'t resolve targets ("' + this._target + '")', 'ENORESTARGET'));
    }

    return this._readJson(this._source)
    .then(this._copy.bind(this))
    .then(this._extract.bind(this));
};

// -----------------

FsResolver.prototype._copy = function (meta) {
    return Q.nfcall(fs.stat, this._source)
    .then(function (stat) {
        var dstFile,
            copyOpts;

        // Pass in the ignore to the copy options to avoid copying ignore files
        // Also, pass in the mode to avoid additional stat calls when copying
        copyOpts = {
            mode: stat.mode,
            ignore: meta.ignore
        };

        // If it's a folder
        if (stat.isDirectory()) {
            return copy.copyDir(this._source, this._tempDir, copyOpts);
        }

        // If it's a file
        // We pass the mode to avoid additional stat calls
        dstFile = path.join(this._tempDir, path.basename(this._source));
        return copy.copyFile(this._source, dstFile, copyOpts);
    }.bind(this));
};

FsResolver.prototype._extract = function () {
    return extract.canExtract(this._source)
    .then(function (canExtract) {
        if (canExtract) {
            return extract(this._tempDir);
        }
    });
};

module.exports = FsResolver;