var Q = require('q');
var path = require('path');
var fs = require('fs');
var createError = require('../util/createError');
var mout = require('mout');

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

    return Q.nfcall(fs.readFile, that._lockFile)
        .then(function (json) {
            // The lockfile was found
            that._lockContents = JSON.parse(json.toString());
            return that.compare();
        }, function(err) {
            if (that._project._options.production && err.code === 'ENOENT') {
                // This is a production install/update
                // a lock file is required
                return Q.reject(createError('No lockfile was found.', 'ENOENT'));
            }
            // This is a non-production install
            // Continue as normal
            return Q.resolve({});
        });
};

LockFile.prototype.compare = function() {
    var that = this;

    return that._project.getTree().then(function (results) {
        var index, ret;
        var lockDependencies = Object.keys(that._lockContents.dependencies);
        var newDependencies = Object.keys(results[0].dependencies);

        mout.object.forOwn(results[0].dependencies, function (dependency, packageName) {
            if ((index = lockDependencies.indexOf(packageName)) !== -1 && ret === undefined) {
                // This is an already existing dependency
                // and not a new one
                newDependencies.splice(index, 1);
                if (
                    that._lockContents.dependencies[packageName].endpoint.target !==
                    results[0].dependencies[packageName].endpoint.target
                ) {
                    // The target version is different
                    ret = Q.reject(createError('Need to run bower update <package>'));
                }
            }
        }, this);

        if (ret === undefined) ret = Q.resolve({});
        return ret;
    });
};

module.exports = LockFile;
