var fs = require('graceful-fs');
var path = require('path');

function read(file, callback) {
    fs.readFile(file, function (err, contents) {
        if (err) return callback(err);

        var json;

        try {
            json = JSON.parse(contents.toString());
        } catch (err) {
            err.code = 'EMALFORMED';
            return callback(err);
        }

        parse(json, callback);
    });
}

function parse(json, callback) {
    // Apply normalisation and validation here
    // If something is invalid, the error.code should be EINVALID
    callback(null, json);
}

function find(folder, callback) {
    var file = path.resolve(path.join(folder, 'bower.json'));

    fs.exists(file, function (exists) {
        if (exists) return callback(null, file);

        file = path.resolve(path.join(folder, 'component.json'));

        fs.exists(file, function (exists) {
            if (exists) return callback(null, file);

            var err = new Error('Neither bower.json nor component.json were found in ' + folder);
            err.code = 'ENOENT';
            callback(err);
        });
    });
}

module.exports = read;
module.exports.read = read;
module.exports.parse = parse;
module.exports.find = find;
