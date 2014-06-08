var Q = require('q');
var path = require('path');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var uuid = require('node-uuid');
var object = require('mout/object');
var fs = require('fs');

exports.require = function (name) {
    return require(path.join(__dirname, '../', name));
};

exports.createTmpDir = function (files) {
    var tempDir = path.join(__dirname, 'tmp/' + uuid.v4());

    beforeEach(function () {
        mkdirp.sync(tempDir);

        if (files) {
            object.forOwn(files, function (contents, filepath) {
                if (typeof contents === 'object') {
                    contents = JSON.stringify(contents, null, ' ');
                }

                var fullPath = path.join(tempDir, filepath);
                mkdirp.sync(path.dirname(fullPath));
                fs.writeFileSync(fullPath, contents);
            });
        }
    });

    afterEach(function () {
        rimraf.sync(tempDir);
    });

    return tempDir;
};

exports.expectEvent = function (emitter, eventName) {
    var deferred = Q.defer();
    emitter.once(eventName, function () {
        deferred.resolve(arguments);
    });
    return deferred.promise;
};
