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
    this._updateNames = [];
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

            if (that._json !== {}) {
                return that.writeFile(that._json);
            }
            return Q.resolve({});
        });
    }
    return Q.resolve({});
};

LockFile.prototype.writeFile = function(json) {
    var that = this;
    var jsonStr = JSON.stringify(json, null, '  ') + '\n';

    return Q.nfcall(fs.writeFile, that._lockFile, jsonStr);
};

LockFile.prototype.preupdate = function(names) {
    var that = this;

    return Q.nfcall(fs.readFile, that._lockFile)
        .then(function (json) {
            // The lockfile was found
            // Store the update names for install event
            that._updateNames = names;
            if (that._project._options.all) {
                // bower update --all should re-create
                // lock-file and do it's thing
                that._generateLockFile = true;
                return Q.resolve({});
            }
            that._lockContents = JSON.parse(json.toString());
            return that.compare(names).spread(function (identical, newDependencies) {
                if (identical) {
                    // bower update is actually not
                    // going to do anything, so let it go
                    return Q.resolve({});
                }
                var updatingNewDependencies = true;
                if (newDependencies.length > 0) {
                    names.forEach(function (value) {
                        if (newDependencies.indexOf(value) === -1) {
                            updatingNewDependencies = false;
                            return false;
                        }
                    });

                    if (updatingNewDependencies) {
                        // This will only be installing
                        // new pacakges and should be errored by Project
                        that._generateLockFile = true;
                        return Q.resolve({});
                    }
                }
                if (names) {
                    // If we have gotten this far
                    // we are ok to run update as is on the
                    // package names provided
                    that._generateLockFile = true;
                    return Q.resolve({});
                }
                return Q.reject(createError('No package specified to update'));
            });
        }, function (err) {
            var nothingInstalled = true;
            if (that._project._installed !== {}) {
                for(var i in that._project._installed) {
                    if (!that._project._installed[i].missing && !that._project._installed[i].linked) {
                        nothingInstalled = false;
                        break;
                    }
                }
            }
            if (nothingInstalled) {
                // There are no packages installed,
                // treat this as a `bower install`
                that._generateLockFile = true;
                // Continue as normal
                return Q.resolve({});
            }
            return Q.reject(createError('No lockfile was found.', 'ENOENT'));
        });
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
    var options = mout.lang.clone(that._project._options);
    return that._project.getJson().then(function() {
        return Q.nfcall(fs.readFile, that._lockFile)
            .then(function (json) {
                // The lockfile was found
                that._lockContents = JSON.parse(json.toString());
                return that.compare().spread(function (identical, newDependencies) {
                    // Something is overwriting the options
                    // So, we just put them back here...
                    that._project._options = options;
                    if (!identical && that._project._options.production) {
                        return Q.reject(createError('bower.json does not match lockfile'));
                    }

                    mout.object.forOwn(that._project._json, function(dependencies, type) {
                        if (['dependencies', 'devDependencies'].indexOf(type) > -1) {
                            mout.object.forOwn(dependencies, function(dependency, packageName) {
                                if (newDependencies.indexOf(packageName) > -1) {
                                    that._generateLockFile = true;
                                } else {
                                    // This is not a new dependency
                                    var lockedPkgInfo = that._lockContents.dependencies[packageName];
                                    that._project._json[type][packageName] =
                                        lockedPkgInfo.pkgMeta._source + '#' + lockedPkgInfo.pkgMeta._release;
                                }
                            });
                        }
                    });

                    // Have to force the manager to configure
                    // again now that we changed the _json
                    that._project._manager.configure({});

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

LockFile.prototype.install = function(pkgMeta) {
    var that = this;

    if (that._lockContents) {
        if (that._lockContents.dependencies[pkgMeta.name] && that._updateNames.indexOf(pkgMeta.name) === -1) {
            // Validate package pulled is correct against lockfile
            if (that._lockContents.dependencies[pkgMeta.name].pkgMeta._resolution.commit !== pkgMeta._resolution.commit) {
                console.log('MISMATCH');
                console.log(pkgMeta.name);
                return Q.reject(createError('Commit hash mis-match'));
            }
            return Q.resolve({});
        } else {
            // New package being installed or package is being updated
            return Q.resolve({});
        }
    } else {
        // No lockfile, proceed
        return Q.resolve({});
    }
};

LockFile.prototype.isDev = function(packageName) {
    return this._project._json.dependencies[packageName] === undefined;
};

LockFile.prototype.compare = function(names) {
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
                    if (!names) {
                        // The target version is different
                        ret = Q.reject(createError('Need to run bower update <package>'));
                    } else {
                        // This is a `bower update <package>`
                        if (names.indexOf(packageName) === -1) {
                            ret = Q.reject(createError('Need to run bower update <package>'));
                        } else {
                            var isValid = true;
                            mout.object.forOwn(results[0].dependencies[packageName].dependencies, function (dependency, packageName) {
                                // Is this a dependency that another package already uses?
                                if (lockDependencies.indexOf(packageName) > -1) {
                                    // Yes, another dependency relies on this same dependency
                                    // Is it the same version installed?
                                    if (that._lockContents.dependencies[packageName].pkgMeta.version !== dependency.pkgMeta.version) {
                                        // the version is not the same. This would modify
                                        // the lockfile outside of this package - FAIL
                                        ret = Q.reject(createError('Need to run bower update --all'));
                                        isValid = false;
                                        return false;
                                    }
                                }
                            });
                        }
                    }
                }
            }
        });

        if (newDependencies.length > 0) {
            identical = false;
        }

        if (ret === undefined) ret = Q.resolve([identical, newDependencies]);
        return ret;
    });
};

module.exports = LockFile;
