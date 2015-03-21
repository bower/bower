var Q = require('q');
var path = require('path');
var fs = require('fs');
var createError = require('../util/createError');

function LockFile(Project) {
    this._project = Project;
    this._config = this._project._config;
    this._lockFile = path.join(this._config.cwd || '', 'bower.lock');
}

LockFile.prototype.generate = function() {
    var that = this;

    if (!that._project._options.production) {
        return that._project.getTree().then(function (results) {
            that._json = results[0];
            return that.writeFile(that._json);
        });
    }
    return Q.resolve({});
};

LockFile.prototype.writeFile = function(json) {
    var that = this;
    var jsonStr = JSON.stringify(json, null, '  ') + '\n';

    return Q.nfcall(fs.writeFile, that._lockFile, jsonStr);
};

LockFile.prototype.preinstall = function() {
    var that = this;

    if (that._project._options.production) {
        // This is a production install/update
        // a lock file is required
        return Q.nfcall(fs.readFile, that._lockFile)
            .spread(function (json, jsonFile) {
                console.log(json);
            }, function(err) {
                if (err.code === 'ENOENT') {
                    // No lockFile was found
                    // throw an error to the user
                    return Q.reject(createError('No lockfile was found. Run bower install first.', 'ENOENT'));
                }
            });
    }
    return Q.resolve({});
};

module.exports = LockFile;
