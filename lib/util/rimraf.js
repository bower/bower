var rimraf = require('rimraf');
var chmodr = require('chmodr');
var fs = require('fs');

module.exports = function (dir, callback) {
    var checkAndRetry = function (err) {
        fs.stat(dir, function (err, stats) {
            if (err) {
                if (err.code === 'ENOENT') return callback();
                return callback(err);
            }

            chmodr(dir, 0777, function (err) {
                if (err) return callback(err);
                rimraf(dir, callback);
            });
        });
    };

    rimraf(dir, checkAndRetry);
};

module.exports.sync = function (dir) {
    var checkAndRetry = function () {
        try {
            fs.statSync(dir);
            chmodr.sync(dir, 0777);
            return rimraf.sync(dir);
        } catch (e) {
            if (e.code === 'ENOENT') return;
            throw e;
        }
    };

    try {
        return rimraf.sync(dir);
    } catch (e) {
        return checkAndRetry();
    } finally {
        return checkAndRetry();
    }
};
