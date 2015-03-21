var Q = require('q');
var path = require('path');
var fs = require('fs');

function LockFile(Project) {
    this._project = Project;
    this._config = this._project._config;
    this._lockFile = path.join(this._config.cwd, 'bower.lock');
}

LockFile.prototype.generate = function() {
    var that = this;

    that._json = {};
    return that.writeFile(that._json);
};

LockFile.prototype.writeFile = function(json) {
    var that = this;
    var jsonStr = JSON.stringify(json, null, '  ') + '\n';

    return Q.nfcall(fs.writeFile, that._lockFile, jsonStr);
};

module.exports = LockFile;
