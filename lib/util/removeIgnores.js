var util = require('util');
var rimraf = require('rimraf');
var IgnoreReader = require('fstream-ignore');
var Q = require('Q');

// Special reader class that only emits entries
// for files that were ignored, instead of the opposite
var IgnoreFinder = function () {
    return IgnoreReader.apply(this, arguments);
};

util.inherits(IgnoreFinder, IgnoreReader);

// --------

IgnoreFinder.prototype.applyIgnores = function () {
    return !IgnoreReader.prototype.applyIgnores.apply(this, arguments);
};

// --------

function removeIgnores(dir, ignore) {
    var reader,
        deferred = Q.defer(),
        files = [];

    reader = new IgnoreFinder({
        path: dir,
        type: 'Directory'
    });

    reader.addIgnoreRules(ignore);

    reader
    .on('entry', function (entry) {
        files.push(entry.path);
    })
    .on('error', deferred.reject)
    .on('end', function () {
        var promises = files.map(function (file) {
            return Q.nfcall(rimraf, file);
        });

        return Q.all(promises)
        .then(deferred.resolve, deferred.reject);
    });

    return deferred.promise;
}

module.exports = removeIgnores;