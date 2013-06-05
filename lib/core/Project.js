var glob = require('glob');
var path = require('path');
var fs = require('fs');
var Q = require('q');
var mout = require('mout');
var rimraf = require('rimraf');
var promptly = require('promptly');
var bowerJson = require('bower-json');
var Manager = require('./Manager');
var Logger = require('./Logger');
var defaultConfig = require('../config');
var createError = require('../util/createError');
var endpointParser = require('../util/endpointParser');

function Project(config, logger) {
    // This is the only architecture component that ensures defaults
    // on config and logger
    // The reason behind it is that users can likely use this component
    // directly if commands do not fulfil their needs
    this._config = config || defaultConfig;
    this._logger = logger || new Logger();
    this._manager = new Manager(this._config, this._logger);
}

// -----------------

Project.prototype.install = function (endpoints, options) {
    var that = this;
    var targets = [];
    var resolved = {};

    // If already working, error out
    if (this._working) {
        return Q.reject(createError('Already working', 'EWORKING'));
    }

    options = options || {};
    this._production = !!options.production;

    // Analyse the project
    return this.analyse()
    .spread(function (json, tree, flattened) {
        var promise;

        // Walk down the tree adding missing as targets
        that._walkTree(tree, function (node, name) {
            if (node.missing) {
                targets.push(node);
            } else if (!node.incompatible) {
                resolved[name] = node;
            }
        }, true);

        // Add endpoints as targets
        if (endpoints) {
            endpoints.forEach(function (endpoint) {
                var decEndpoint = endpointParser.decompose(endpoint);
                decEndpoint.specified = true;
                targets.push(decEndpoint);
            });
        }

        // If there are targets configured, add incompatible
        if (targets.length) {
            that._walkTree(tree, function (node) {
                if (node.incompatible) {
                    targets.push(node);
                }
            }, true);
        }

        // Bootstrap the process
        promise = that._bootstrap(targets, resolved, flattened);

        // If there are targets configured, listen to when they
        // resolve in order to remove any associated resolution
        // This can only be done at this step because endpoint names
        // are not fully known before
        if (endpoints) {
            promise = promise.progress(function (decEndpoint) {
                var resolutions;

                if (decEndpoint.specified) {
                    resolutions = that._manager.getResolutions();
                    delete resolutions[decEndpoint.name];
                    delete decEndpoint.specified;
                }
            });
        }

        return promise;
    })
    .then(function (installed) {
        // Handle save and saveDev options
        if (options.save || options.saveDev) {
            // Cycle through the initial targets and not the installed
            // ones because some targets could already be installed
            mout.object.forOwn(targets, function (decEndpoint) {
                var source = decEndpoint.registry ? '' : decEndpoint.source;
                var target = decEndpoint.target;
                var endpoint = mout.string.ltrim(source + '#' + target, ['#']);

                if (options.save) {
                    that._json.dependencies = that._json.dependencies || {};
                    that._json.dependencies[decEndpoint.name] = endpoint;
                }

                if (options.saveDev) {
                    that._json.devDependencies = that._json.devDependencies || {};
                    that._json.devDependencies[decEndpoint.name] = endpoint;
                }
            });
        }

        // Save JSON, might contain changes to dependencies
        // and resolutions
        return that._saveJson()
        .then(function () {
            return installed;
        });
    })
    .fin(function () {
        that._working = false;
    });
};

Project.prototype.update = function (names, options) {
    var that = this;
    var targets = [];
    var resolved = {};

    // If already working, error out
    if (this._working) {
        return Q.reject(createError('Already working', 'EWORKING'));
    }

    options = options || {};
    this._production = !!options.production;

    // Analyse the project
    return this.analyse()
    .spread(function (json, tree, flattened) {
        // If no names were specified, update every package
        if (!names) {
            // Mark each json entry as targets
            mout.object.forOwn(json.dependencies, function (value, key) {
                var decEndpoint = endpointParser.json2decomposed(key, value);
                decEndpoint.dependants = {};
                decEndpoint.dependants[tree.name] = tree;

                targets.push(decEndpoint);
            });

            // Mark extraneous as targets
            mout.object.forOwn(flattened, function (decEndpoint) {
                if (decEndpoint.extraneous) {
                    targets.push(decEndpoint);
                }
            });
        // Otherwise, selectively update the specified ones
        } else {
            // Walk down the tree adding missing, incompatible
            // and names as targets
            that._walkTree(tree, function (node, name) {
                if (node.missing || node.incompatible) {
                    targets.push(node);
                } else if (names.indexOf(name) !== -1) {
                    targets.push(node);
                } else {
                    resolved[name] = node;
                }
            }, true);

            // Mark extraneous as targets only if it's not already a target
            mout.object.forOwn(flattened, function (decEndpoint) {
                var foundTarget;
                var name = decEndpoint.name;

                if (decEndpoint.extraneous && names.indexOf(name) !== -1) {
                    foundTarget = !!mout.array.find(targets, function (target) {
                        return target.name === name;
                    });

                    if (!foundTarget) {
                        targets.push(decEndpoint);
                    }
                }
            });

            // Error out if some of the names were not found
            names.forEach(function (name) {
                var foundTarget;

                foundTarget = !!mout.array.find(targets, function (target) {
                    return target.name === name;
                });

                if (!foundTarget) {
                    throw createError('Package ' + name + ' is not installed', 'ENOTINS', {
                        name: name
                    });
                }
            });
        }

        // Bootstrap the process
        return that._bootstrap(targets, resolved, flattened)
        // Save JSON, might contain changes to resolutions
        .then(that._saveJson.bind(that));
    })
    .fin(function () {
        that._working = false;
    });
};

Project.prototype.uninstall = function (names, options) {
    var that = this;
    var packages = {};

    // Analyse the project
    return this.analyse()
    // Fill in the packages to be uninstalled
    .spread(function (json, tree, flattened) {
        var promise = Q.resolve();

        names.forEach(function (name) {
            var decEndpoint = flattened[name];

            // Check if it is not installed
            if (!decEndpoint || decEndpoint.missing) {
                packages[name] = null;
                return;
            }

            promise = promise
            .then(function () {
                var dependants;
                var message;
                var data;

                // Check if it has dependants
                // Note that the root is filtered from the dependants
                // as well as other dependants marked to be uninstalled
                dependants = [];
                mout.object.forOwn(decEndpoint.dependants, function (decEndpoint) {
                    if (!decEndpoint.root && names.indexOf(decEndpoint.name) === -1) {
                        dependants.push(decEndpoint);
                    }
                });

                // If the package has no dependants or the force config is enabled,
                // mark it to be removed
                if (!dependants.length || that._config.force) {
                    packages[name] = decEndpoint.canonicalPkg;
                    return;
                }

                // Otherwise we need to figure it out if the user really wants to remove it,
                // even with dependants
                message = dependants.map(function (dep) { return dep.name; }).join(', ') + ' depends on ' + decEndpoint.name;
                data = {
                    package: decEndpoint.name,
                    dependants: dependants.map(function (decEndpoint) {
                        return decEndpoint.name;
                    })
                };

                // If interactive is disabled, error out
                if (!that._config.interactive) {
                    throw createError(message, 'ECONFLICT', {
                        data: data
                    });
                }

                that._logger.conflict('mutual', message, data);

                // Question the user
                return Q.nfcall(promptly.confirm, 'Continue anyway? (y/n)')
                .then(function (confirmed) {
                    // If the user decided to skip it, remove from the array so that it won't
                    // influence subsequent dependants
                    if (!confirmed) {
                        mout.array.remove(names, name);
                    } else {
                        packages[name] = decEndpoint.canonicalPkg;
                    }
                });
            });
        });

        return promise;
    })
    // Remove packages
    .then(function () {
        return that._removePackages(packages, options);
    });
};

Project.prototype.analyse = function () {
    return Q.all([
        this._readJson(),
        this._readInstalled()
    ])
    .spread(function (json, installed) {
        var root;
        var flattened = installed;

        root = {
            name: json.name,
            source: this._config.cwd,
            target: json.version,
            pkgMeta: json,
            canonicalPkg: this._config.cwd,
            root: true
        };

        // Restore the original dependencies cross-references,
        // that is, the parent-child relationships
        this._restoreNode(root, flattened, 'dependencies');
        // Do the same for the dev dependencies
        if (!this._production) {
            this._restoreNode(root, flattened, 'devDependencies');
        }

        // Parse extraneous
        mout.object.forOwn(flattened, function (decEndpoint) {
            var release;

            if (!decEndpoint.dependants) {
                decEndpoint.extraneous = true;

                // Restore it
                this._restoreNode(decEndpoint, flattened, 'dependencies');
                // Do the same for the dev dependencies
                if (!this._production) {
                    this._restoreNode(decEndpoint, flattened, 'devDependencies');
                }

                release = decEndpoint.pkgMeta._release;
                this._logger.log('warn', 'extraneous', decEndpoint.name + (release ? '#' + release : release), {
                    pkgMeta: decEndpoint.pkgMeta,
                    canonicalPkg: decEndpoint.canonicalPkg
                });
            }
        }, this);

        // Remove root from the flattened tree
        delete flattened[json.name];

        return [json, root, flattened];
    }.bind(this));
};

// -----------------

Project.prototype._bootstrap = function (targets, resolved, flattened) {
    var installed = mout.object.map(flattened, function (decEndpoint) {
        return decEndpoint.pkgMeta;
    });

    // Configure the manager and kick in the resolve process
    return this._manager
    .setProduction(this._production)
    .setResolutions(this._json.resolutions)
    .configure(targets, resolved, installed)
    .resolve()
    .then(function () {
        var resolutions = this._manager.getResolutions();

        // Update resolutions
        if (mout.object.size(resolutions)) {
            this._json.resolutions = resolutions;
        } else {
            delete this._json.resolutions;
        }

        // Install resolved ones
        return this._manager.install();
    }.bind(this));
};

Project.prototype._readJson = function () {
    var that = this;

    if (this._json) {
        return Q.resolve(this._json);
    }

    // Read local json
    return this._json = Q.nfcall(bowerJson.find, this._config.cwd)
    .then(function (filename) {
        // If it is a component.json, warn about the deprecation
        if (path.basename(filename) === 'component.json') {
            process.nextTick(function () {
                that._logger.warn('deprecated', 'You are using the deprecated component.json file', {
                    json: filename
                });
            });
        }

        that._jsonFile = filename;

        // Read it
        return Q.nfcall(bowerJson.read, filename)
        .fail(function (err) {
            throw createError('Something went wrong while reading "' + filename + '"', err.code, {
                details: err.message
            });
        });
    }, function () {
        // No json file was found, assume one
        return Q.nfcall(bowerJson.parse, {
            name: path.basename(that._config.cwd)
        });
    })
    .then(function (json) {
        return that._json = json;
    });
};

Project.prototype._saveJson = function () {
    if (!this._jsonFile) {
        this._logger.warn('no-json', 'No bower.json file to save to');
        return Q.resolve();
    }

    return Q.nfcall(fs.writeFile, this._jsonFile, JSON.stringify(this._json, null, '  '));
};

Project.prototype._readInstalled = function () {
    var componentsDir = path.join(this._config.cwd, this._config.directory);

    // Gather all folders that are actual packages by
    // looking for the package metadata file
    return Q.nfcall(glob, '*/.bower.json', {
        cwd: componentsDir,
        dot: true
    })
    .then(function (filenames) {
        var promises = [];
        var decEndpoints = {};

        // Foreach bower.json found
        filenames.forEach(function (filename) {
            var promise;
            var name = path.dirname(filename);
            var jsonFile = path.join(componentsDir, filename);

            // Read package metadata
            promise = Q.nfcall(fs.readFile, jsonFile)
            .then(function (contents) {
                var pkgMeta = JSON.parse(contents.toString());

                decEndpoints[name] = {
                    name: name,
                    source: pkgMeta._source,
                    target: pkgMeta.version || '*',
                    canonicalPkg: path.dirname(jsonFile),
                    pkgMeta: pkgMeta
                };
            });

            promises.push(promise);
        });

        // Wait until all files have been read
        // and resolve with the decomposed endpoints
        return Q.all(promises)
        .then(function () {
            return decEndpoints;
        });
    });
};

Project.prototype._removePackages = function (packages, options) {
    var promises = [];

    mout.object.forOwn(packages, function (dir, name) {
        var promise;

        // Delete directory
        if (!dir) {
            promise = Q.resolve();
            this._logger.info('absent', name, {
                package: name
            });
        } else {
            promise = Q.nfcall(rimraf, dir);
            this._logger.action('uninstall', name, {
                package: name,
                dir: dir
            });
        }

        // Remove from json only if successfully deleted
        if (options.save && this._json.dependencies) {
            promise = promise
            .then(function () {
                delete this._json.dependencies[name];
            }.bind(this));
        }

        if (options.saveDev && this._json.devDependencies) {
            promise = promise
            .then(function () {
                delete this._json.devDependencies[name];
            }.bind(this));
        }

        promises.push(promise);
    }, this);

    return Q.all(promises)
    // Save json
    .then(this._saveJson.bind(this))
    // Resolve with removed packages
    .then(function () {
        return packages;
    });
};

Project.prototype._walkTree = function (node, fn, onlyOnce) {
    var queue = mout.object.values(node.dependencies);
    var result;
    var deps;

    if (onlyOnce === true) {
        onlyOnce = [];
    }

    while (queue.length) {
        node = queue.shift();
        result = fn(node, node.name);

        if (onlyOnce) {
            onlyOnce.push(node);
        }

        // Abort traversal if result is false
        if (result === false) {
            continue;
        }

        // Add dependencies to the queue
        deps = mout.object.values(node.dependencies);
        // If onlyOnce was true, do not add if already traversed
        if (onlyOnce) {
            deps = deps.filter(function (dep) {
                return onlyOnce.indexOf(dep) === -1;
            });
        }

        queue.unshift.apply(queue, deps);
    }
};

Project.prototype._restoreNode = function (node, flattened, jsonKey) {
    // Do not restore if already processed or if the node is
    // missing or incompatible
    if (node.dependencies || node.missing || node.incompatible) {
        return;
    }

    node.dependencies = {};
    node.dependants = node.dependants || {};

    mout.object.forOwn(node.pkgMeta[jsonKey], function (value, key) {
        var local = flattened[key];
        var json = endpointParser.json2decomposed(key, value);
        var compatible;

        // Check if the dependency is not installed
        if (!local) {
            flattened[key] = local = json;
            local.missing = true;
        // Even if it is installed, check if it's compatible
        } else {
            if (local.missing) {
                compatible = this._manager.areCompatible(local.target, json.target);
            } else {
                compatible = this._manager.areCompatible(local.pkgMeta.version || '*', json.target);
            }

            if (!compatible) {
                local = json;
                local.incompatible = true;
            } else {
                mout.object.mixIn(local, json);
            }
        }

        // Cross reference
        node.dependencies[key] = local;
        local.dependants = local.dependants || {};
        local.dependants[node.name] = node;

        // Call restore for this dependency
        this._restoreNode(local, flattened, jsonKey);
    }, this);
};

module.exports = Project;
