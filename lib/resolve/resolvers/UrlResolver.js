var util = require('util');
var path = require('path');
var fs = require('fs');
var request = require('request');
var Q = require('q');
var mout = require('mout');
var Resolver = require('../Resolver');
var extract = require('../../util/extract');
var createError = require('../../util/createError');
var osJunk = require('../../util/osJunk');

var UrlResolver = function (source, options) {
    var pos;

    Resolver.call(this, source, options);

    // If target was specified, error out
    if (this._target !== '*') {
        throw createError('URL sources can\'t resolve targets', 'ENORESTARGET');
    }

    // If the name was guessed, remove the ? part
    if (this._guessedName) {
        pos = this._name.indexOf('?');
        if (pos !== -1) {
            this._name = path.basename(this._name.substr(0, pos));
        }
    }
};

util.inherits(UrlResolver, Resolver);

// -----------------

UrlResolver.prototype._hasNew = function (pkgMeta) {
    var oldCacheHeaders = pkgMeta._cacheHeaders || {},
        reqHeaders = {};

    // If the previous cache headers contain an ETag,
    // send the "If-None-Match" header with it
    if (oldCacheHeaders.ETag) {
        reqHeaders['If-None-Match'] = oldCacheHeaders.ETag;
    }

    // Make an HEAD request to the source
    return Q.nfcall(request.head, this._source, {
        proxy: this._config.proxy,
        timeout: 5000,
        headers: reqHeaders
    })
    // Compare new headers with the old ones
    .spread(function (response) {
        var cacheHeaders;

        // If the server responded with 303 then the resource
        // still has the same ETag
        if (response.statusCode === 304) {
            return false;
        }

        // If status code is not in the 2xx range,
        // then just resolve to true
        if (response.statusCode < 200 || response.statusCode >= 300) {
            return true;
        }

        // Fallback to comparing cache headers
        cacheHeaders = this._collectCacheHeaders(response);
        return !mout.object.equals(oldCacheHeaders, cacheHeaders);
    }.bind(this), function () {
        // Assume new contents if the request failed
        return true;
    });
};

// TODO: there's room for improvement by using streams if the url
//       is an archive file, by piping read stream to the zip extractor
//       this will likely increase the complexity of code but might worth it

UrlResolver.prototype._resolve = function () {
    // If target was specified, simply reject the promise
    if (this._target !== '*') {
        return Q.reject(createError('URL sources can\'t resolve targets', 'ENORESTARGET'));
    }

    return this._download()
    .spread(this._parseHeaders.bind(this))
    .spread(this._extract.bind(this))
    .then(this._rename.bind(this));
};

// -----------------

UrlResolver.prototype._download = function () {
    var file = path.join(this._tempDir, this._name),
        deferred = Q.defer(),
        req,
        res,
        writer,
        finish,
        that = this;

    finish = function (err) {
        // Ensure that all listeners are removed
        req.removeAllListeners();
        writer.removeAllListeners();

        // If we got an error, simply reject the deferred
        if (err) {
            return deferred.reject(err);
        } else {
            that._response = res;
            return deferred.resolve([file, res]);
        }
    };

    // Make the request to the source
    req = request(this._source, {
        proxy: this._config.proxy,
        timeout: 5000
    })
    .on('response', function (response) {
        res = response;
    })
    .on('error', finish);

    // Create a write stream to the end file
    writer = fs.createWriteStream(file)
    .on('error', finish)
    .on('close', finish);

    // Pipe request response to writer
    req.pipe(writer);

    return deferred.promise;
};

UrlResolver.prototype._parseHeaders = function (file, response) {
    var disposition,
        newFile,
        match;

    // Check if we got a Content-Disposition header
    disposition = response.headers['content-disposition'];
    if (!disposition) {
        return Q.resolve([file, response]);
    }

    // Since there's various security issues with parsing this header, we only
    // interpret word chars plus dots, dashes and spaces
    match = disposition.match(/filename=(?:"([\w\-\. ]+)")/i);
    if (!match) {
        // The spec defines that the filename must be in quotes,
        // though a wide range of servers do not follow the rule
        match = disposition.match(/filename=([\w\-\.]+)/i);
        if (!match) {
            return Q.resolve([file, response]);
        }
    }

    // Trim spaces
    newFile = match[1].trim();

    // The filename can't end with a dot because this is known
    // to cause issues in Windows
    // See: http://superuser.com/questions/230385/dots-at-end-of-file-name
    if (mout.string.endsWith(newFile, '.')) {
        return Q.resolve([file, response]);
    }

    newFile = path.join(this._tempDir, newFile);

    return Q.nfcall(fs.rename, file, newFile)
    .then(function () {
        return [newFile, response];
    });
};

UrlResolver.prototype._extract = function (file, response) {
    var mimeType = response.headers['content-type'];

    if (!extract.canExtract(mimeType || file)) {
        return Q.resolve();
    }

    return extract(file, this._tempDir, {
        mimeType: mimeType
    });
};

UrlResolver.prototype._rename = function () {
    return Q.nfcall(fs.readdir, this._tempDir)
    .then(function (files) {
        var file,
            oldPath,
            newPath;

        // Remove any OS specific files from the files array
        // before checking its length
        files = files.filter(osJunk.isNotOsJunk);

        if (files.length === 1) {
            file = files[0];
            this._singleFile = 'index' + path.extname(file);
            oldPath = path.join(this._tempDir, file);
            newPath = path.join(this._tempDir, this._singleFile);

            return Q.nfcall(fs.rename, oldPath, newPath);
        }
    }.bind(this));
};

UrlResolver.prototype._savePkgMeta = function (meta) {
    // Store collected headers in the package meta
    meta._cacheHeaders = this._collectCacheHeaders(this._response);

    // Store main if is a single file
    if (this._singleFile) {
        meta.main = this._singleFile;
    }

    return Resolver.prototype._savePkgMeta.call(this, meta);
};

UrlResolver.prototype._collectCacheHeaders = function (res) {
    var headers = {};

    // Collect cache headers
    this.constructor._cacheHeaders.forEach(function (name) {
        var value = res.headers[name.toLowerCase()];

        if (value != null) {
            headers[name] = value;
        }
    });

    return headers;
};

UrlResolver._cacheHeaders = [
    'Content-MD5',
    'ETag',
    'Last-Modified',
    'Content-Language',
    'Content-Length',
    'Content-Type',
    'Content-Disposition'
];

module.exports = UrlResolver;