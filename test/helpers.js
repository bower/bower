var Q = require('q');
var path = require('path');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var uuid = require('node-uuid');
var object = require('mout/object');
var fs = require('fs');
var object = require('mout/object');
var config = require('../lib/config');

exports.require = function (name) {
    return require(path.join(__dirname, '../', name));
};

// We need to reset cache because tests are reusing temp directories
beforeEach(function () {
    config.reset();
});

after(function () {
    rimraf.sync(path.join(__dirname, 'tmp'));
});

exports.TempDir = (function() {
    function TempDir (defaultFiles) {
        this.path = path.join(__dirname, 'tmp/' + uuid.v4());
        this.defaultFiles = defaultFiles;
    }

    TempDir.prototype.prepare = function (files) {
        var that = this;

        files = object.merge(files || {}, this.defaultFiles);

        rimraf.sync(that.path);

        mkdirp.sync(that.path);

        if (files) {
            object.forOwn(files, function (contents, filepath) {
                if (typeof contents === 'object') {
                    contents = JSON.stringify(contents, null, ' ') + '\n';
                }

                var fullPath = path.join(that.path, filepath);
                mkdirp.sync(path.dirname(fullPath));
                fs.writeFileSync(fullPath, contents);
            });
        }

        return this;
    };

    TempDir.prototype.read = function (name) {
        return fs.readFileSync(path.join(this.path, name), 'utf8');
    };

    TempDir.prototype.exists = function (name) {
        return fs.existsSync(path.join(this.path, name));
    };

    return TempDir;
})();

exports.expectEvent = function (emitter, eventName) {
    var deferred = Q.defer();

    emitter.once(eventName, function () {
        deferred.resolve(arguments);
    });

    return deferred.promise;
};
