var path = require('path');
var bowerJson = require('bower-json');
var Q = require('q');

function readJson(file, options) {
    options = options || {};

    // Read
    return Q.nfcall(bowerJson.read, file, options)
    .spread(function (json, jsonFile) {
        var deprecated;

        jsonFile = path.basename(jsonFile);
        deprecated = jsonFile === 'component.json' ? jsonFile : false;

        return [json, deprecated];
    }, function (err) {
        // No json file was found, assume one
        if (err.code === 'ENOENT' && options.name) {
            return [bowerJson.parse({ name: options.name }), false];
        }

        err.details = err.message;

        if (err.file) {
            err.message = 'Failed to read ' + err.file;
            err.data = { filename: err.file };
        } else {
            err.message = 'Failed to read json from ' + file;
        }

        throw err;
    });
}

module.exports = readJson;
