var fs = require('graceful-fs');

var readdir = fs.readdir.bind(fs);
var readdirSync = fs.readdirSync.bind(fs);

module.exports = fs;

module.exports.readdir = function (dir, callback) {
    fs.stat(dir, function (err, stats) {
        if (err) return callback(err);

        if (stats.isDirectory()) {
            return readdir(dir, callback);
        } else if (stats.isSymbolicLink()) {
            fs.readlink(dir, function(err, linkedDir) {
              if (err) return callback(err);

              return module.exports.readdir(linkedDir, callback);
            });
        } else {
            var error = new Error('ENOTDIR, not a directory \'' + dir + '\'');
            error.code = 'ENOTDIR';
            error.path = dir;
            error.errono = -20;
            return callback(error);
        }
    });
};

module.exports.readdirSync = function (dir) {
    var stats = fs.statSync(dir);

    if (stats.isDirectory()) {
        return readdirSync(dir);
    } else if (stats.isSymbolicLink()) {
        var linkedDir = fs.readlinkSync(dir);
        return module.exports.readdirSync(linkedDir);
    } else {
        var error = new Error();
        error.code = 'ENOTDIR';
        throw error;
    }
};
