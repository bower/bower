var Q = require('q');
var path = require('path');
var fs = require('fs');
var createError = require('../util/createError');
var mout = require('mout');

function LockFile(Project) {
    this._project = Project;
    this._config = this._project._config;
    this._lockFile = path.join(this._config.cwd || '', 'bower.lock');
    this._generateLockFile = false;
}

LockFile.prototype.generate = function() {
    var that = this;

    if (that._generateLockFile) {
        return that._project.getTree().then(function (results) {
            that._json = results[0];
            mout.object.forOwn(that._json.dependencies, function (dependency, packageName) {
                dependency.pkgMeta = that._project._manager._dissected[packageName].pkgMeta;
            });
            mout.object.forOwn(that._json.devDependencies, function (dependency, packageName) {
                dependency.pkgMeta = that._project._manager._dissected[packageName].pkgMeta;
            });

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

LockFile.prototype.preinstall = function(decEndpoints) {
    var that = this;

    if (decEndpoints !== undefined && decEndpoints.length > 0) {
        if (
            that._project._options.save ||
            that._project._options.saveDev ||
            that._project._options.saveExact
        ) {
            // If the save option was passed
            // we need to update the lockfile
            that._generateLockFile = true;
        }
        // This is a bower install with arguments
        // and not being saved, no need to parse
        // the lockfile as only the packages passed
        // in will be installed anyhow
        return Q.resolve({});
    }

    return that._project.getJson().then(function() {
        return Q.nfcall(fs.readFile, that._lockFile)
            .then(function (json) {
                // The lockfile was found
                that._lockContents = JSON.parse(json.toString());
                return that.compare().spread(function (identical, newDependencies) {
                    if (!identical && that._project._options.production) {
                        return Q.reject(createError('bower.json does not match lockfile'));
                    }
                    var _jsonDep = that._lockContents.pkgMeta.dependencies;
                    newDependencies.forEach(function (value) {
                        that._generateLockFile = true;
                        // Add the new dependencies into the
                        // dependency map that we are going to return
                        // back as the _json.dependencies
                        _jsonDep[value] = that._project._json.dependencies[value];
                    });

                    // Now, update _jsonDep with correct version
                    // from lockfile to return back to _json.dependencies
                    mout.object.forOwn(_jsonDep, function (dependency, packageName) {
                        if (that._lockContents.dependencies[packageName] !== undefined) {
                            // This is not a new dependency
                            var lockedPkgInfo = that._lockContents.dependencies[packageName];
                            dependency = lockedPkgInfo.pkgMeta._source + '#' + lockedPkgInfo.pkgMeta._release;

                            that._project._manager.configure({});
                        }
                    });

                    that._project._json.dependencies = _jsonDep;

                    return Q.resolve({});
                });
            }, function (err) {
                if (that._project._options.production && err.code === 'ENOENT') {
                    // This is a production install
                    // a lock file is required
                    return Q.reject(createError('No lockfile was found.', 'ENOENT'));
                }
                that._generateLockFile = true;
                // This is a non-production install
                // Continue as normal
                return Q.resolve({});
            });
    });
};

LockFile.prototype.compare = function() {
    var that = this;

    return that._project.getTree().then(function (results) {
        var ret, identical = true;
        var lockDependencies = Object.keys(that._lockContents.dependencies);
        var newDependencies = Object.keys(results[0].dependencies);

        mout.object.forOwn(results[0].dependencies, function (dependency, packageName) {
            if (lockDependencies.indexOf(packageName) !== -1 && ret === undefined) {
                // This is an already existing dependency
                // and not a new one
                newDependencies.splice(newDependencies.indexOf(packageName), 1);
                if (
                    that._lockContents.dependencies[packageName].endpoint.target !==
                    results[0].dependencies[packageName].endpoint.target
                ) {
                    // The target version is different
                    ret = Q.reject(createError('Need to run bower update <package>'));
                }
            }
        }, this);

        if (newDependencies.length > 0) {
            identical = false;
        }

        if (ret === undefined) ret = Q.resolve([identical, newDependencies]);
        return ret;
    });
};

module.exports = LockFile;
