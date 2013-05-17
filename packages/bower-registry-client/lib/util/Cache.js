var fs = require('fs');
var path = require('path');
var async = require('async');
var mkdirp = require('mkdirp');

var hasOwn =  Object.prototype.hasOwnProperty;

var Cache = function (dir, options) {
    options = options || {};

    // Default max age of 5 days
    if (typeof options.maxAge !== 'number') {
        options.maxAge = 5 * 24 * 60 * 60 * 1000;
    }

    this._dir = dir;
    this._options = options;
    this._cache = {};  // TODO: switch to LRU

    if (dir) {
        mkdirp.sync(dir);
    }
};

Cache.prototype.get = function (key, callback) {
    var file;

    // Check in memory
    if (hasOwn.call(this._cache, key)) {
        if (this._hasExpired(this._cache[key])) {
            this.del(key, callback);
        } else {
            callback(null, this._cache[key].value);
        }

        return;
    }

    // Check in disk
    if (!this._dir) {
        return callback(null);
    }

    file = this._getFile(key);
    fs.readFile(file, function (err, contents) {
        var json;

        // If there was an error reading
        // Note that if the file does not exist then
        // we don't got its value
        if (err) {
            return callback(err.code === 'ENOENT' ? null : err);
        }

        // If there was an error reading the file as json
        // simply assume it doesn't exist
        try {
            json = JSON.parse(contents.toString());
        } catch (e) {
            return this.del(key, callback);  // If so, delete it
        }

        // Check if it has expired
        if (this._hasExpired(json)) {
            return this.del(key, callback);
        }

        this._cache[key] = json;
        callback(null, json.value);
    }.bind(this));
};

Cache.prototype.set = function (key, value, maxAge, callback) {
    var file;
    var entry;
    var str;

    if (typeof maxAge === 'function') {
        callback = maxAge;
        maxAge = this._options.maxAge;
    }

    entry = {
        expires: Date.now() + maxAge,
        value: value
    };

    // Store in memory
    this._cache[key] = entry;

    // Store in disk
    if (!this._dir) {
        return callback(null);
    }

    // If there was an error generating the json
    // then there's some cyclic reference or some other issue
    try {
        str = JSON.stringify(entry);
    } catch (e) {
        return callback(e);
    }

    file = this._getFile(key);
    fs.writeFile(file, str, callback);
};

Cache.prototype.del = function (key, callback) {
    // Delete from memory
    delete this._cache[key];

    // Delete from disk
    if (!this._dir) {
        return callback(null);
    }

    fs.unlink(this._getFile(key), callback);
};

Cache.prototype.clear = function (callback) {
    var dir = this._dir;

    // Clear in memory cache
    this._cache = {};

    // Clear everything from the disk
    if (!dir) {
        return callback(null);
    }

    fs.readdir(dir, function (err, files) {
        if (err) {
            return callback(err);
        }

        // Delete every file in parallel
        async.forEach(files, function (file, next) {
            fs.unlink(path.join(dir, file), next);
        }, callback);
    });
};

Cache.prototype._hasExpired = function (json) {
    var expires = json.expires;

    if (!expires) {
        return false;
    }

    // Check if the key has expired
    expires = parseInt(json.expires, 10);
    return !expires || Date.now() > expires;
};

Cache.prototype._getFile = function (key) {
    return path.join(this._dir, encodeURIComponent(key));
};

module.exports = Cache;