var Q = require('q');
var bowerJson = require('bower-json');
var path = require('path');
var createError = require('../util/createError');

function Lock(config, logger){
    this._config = config;
    this._logger = logger;
    this._lockFile = path.join(this._config.cwd, 'bower.lock');
}

Lock.prototype.preinstall = function(json, options) {
    var that = this;

    if (options.production) {
        return Q.nfcall(bowerJson.read, that._lockFile)
            .spread(function (json, jsonFile) {
                console.log(json);
            }, function (err) {
                // bower.lock does not exist
                if (err.code === 'ENOENT') {
                    throw createError('No bower.lock present', 'ENOENT');
                }

                err.details = err.message;
                err.message = 'Failed to read ' + err.file;
                err.data = { filename: err.file };
                throw err;
            });
    }
    return Q.resolve({});
};

Lock.prototype.install = function(json, options) {
    //var that = this;
    //
    //if (options.production) {
    //
    //}
    return Q.resolve({});
};

module.exports = Lock;
