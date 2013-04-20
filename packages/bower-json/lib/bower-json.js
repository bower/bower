var fs = require('fs');
var path = require('path');

function read(file, callback) {
    fs.readFile(file, function (err, contents) {
        if (err) return callback(err);

        var json;

        try {
            json = JSON.parse(contents);
        } catch (e) {
            err = new Error('Not a valid JSON file: ' + e.message);
            err.code = 'EINVFRMT';
            return callback(err);
        }

        callback(null, parse(json));
    });
}

function parse(json) {
    // Apply normalisation, defaults, validation here
    return json;
}

function find(folder, callback) {
    var file = path.resolve(path.join(folder, 'bower.json'));

    fs.exists(file, function (exists) {
        if (exists) return callback(null, file);

        file = path.resolve(path.join(folder, 'component.json'));

        fs.exists(file, function (exists) {
            if (exists) return callback(null, file);

            var err = new Error('Folder has no json file');
            err.code = 'ENOENT';
            callback(err);
        });
    });
}

module.exports = read;
module.exports.read = read;
module.exports.parse = parse;
module.exports.find = find;