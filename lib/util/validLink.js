var Q = require('q');
var fs = require('graceful-fs');

function validLink(file) {
    // Ensures that a file is a symlink that points
    // to a valid file
    return Q.nfcall(fs.lstat, file)
    .then(function (stat) {
        if (!stat.isSymbolicLink()) {
            return [false];
        }

        return Q.nfcall(fs.stat, file)
        .then(function () {
            return [stat];
        });
    })
    .fail(function (err) {
        return [false, err];
    });
}

module.exports = validLink;

