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
    var incompatibles = [];

    // If already working, error out
    if (this._working) {
        return Q.reject(createError('Already working', 'EWORKING'));
    }

    options = options || {};
    this._production = !!options.production;
    this._working = true;

    // Analyse the project
    return this.analyse()
    .spread(function (json, tree) {
        // Walk down the tree adding targets, resolved and incompatibles
        that._walkTree(tree, function (node, name) {
            if (node.missing) {
                targets.push(node);
            } else if (node.incompatible) {
                incompatibles.push(node);
            } else {
                resolved[name] = node;
            }
        }, true);

        // Add endpoints as targets
        if (endpoints) {
            endpoints.forEach(function (endpoint) {
                var decEndpoint = endpointParser.decompose(endpoint);
                // Mark as unresolvable so that a conflict for this target always require
                // a choice
                decEndpoint.unresolvable = true;
                targets.push(decEndpoint);
            });
        }

        // Bootstrap the process
        return that._bootstrap(targets, resolved, incompatibles);
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
        this._installed = null;
        that._working = false;
    });
};

Project.prototype.update = function (names, options) {
    var that = this;
    var targets = [];
    var resolved = {};
    var incompatibles = [];

    // If already working, error out
    if (this._working) {
        return Q.reject(createError('Already working', 'EWORKING'));
    }

    options = options || {};
    this._production = !!options.production;
    this._working = true;

    // Analyse the project
    return this.analyse()
    .spread(function (json, tree, flattened) {
        // If no names were specified, update every package
        if (!names) {
            // Mark each root dependency as targets
            that._walkTree(tree, function (node) {
                targets.push(node);
                return false;
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
            // and resolved
            that._walkTree(tree, function (node, name) {
                if (node.missing) {
                    targets.push(node);
                } else if (node.incompatible) {
                    incompatibles.push(node);
                } else {
                    resolved[name] = node;
                }
            }, true);

            // Add root packages that match the name as targets
            that._walkTree(tree, function (node, name) {
                if (names.indexOf(name) !== -1) {
                    targets.push(node);
                }
                return false;
            });

            // Mark extraneous that match the name as targets
            mout.object.forOwn(flattened, function (decEndpoint, name) {
                if (decEndpoint.extraneous && names.indexOf(name) !== -1) {
                    targets.push(decEndpoint);
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
        return that._bootstrap(targets, resolved, incompatibles)
        // Save JSON, might contain changes to resolutions
        .then(that._saveJson.bind(that));
    })
    .fin(function () {
        this._installed = null;
        that._working = false;
    });
};

Project.prototype.uninstall = function (names, options) {
    var that = this;
    var packages = {};

    // If already working, error out
    if (this._working) {
        return Q.reject(createError('Already working', 'EWORKING'));
    }

    this._working = true;

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
                    name: decEndpoint.name,
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
    })
    .fin(function () {
        this._installed = null;
        that._working = false;
    });
};

Project.prototype.analyse = function () {
    return Q.all([
        this._readJson(),
        this._readInstalled()
    ])
    .spread(function (json, installed) {
        var root;
        var flattened = mout.object.mixIn({}, installed);

        root = {
            name: json.name,
            source: this._config.cwd,
            target: json.version || '*',
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
                this._logger.log('warn', 'extraneous', decEndpoint.name + (release ? '#' + release : ''), {
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

Project.prototype._bootstrap = function (targets, resolved, incompatibles) {
    var installed = mout.object.map(this._installed, function (decEndpoint) {
        return decEndpoint.pkgMeta;
    });

    this._json.resolutions = this._json.resolutions || {};

    // Configure the manager and kick in the resolve process
    return this._manager
    .configure({
        production: this._production,
        targets: targets,
        resolved: resolved,
        incompatibles: incompatibles,
        resolutions: this._json.resolutions,
        installed: installed
    })
    .resolve()
    .then(function () {
        // If the resolutions is empty, delete key
        if (!mout.object.size(this._json.resolutions)) {
            delete this._json.resolutions;
        }
    }.bind(this))
    // Install resolved ones
    .then(this._manager.install.bind(this._manager));
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
            throw createError('Something went wrong while reading ' + filename, err.code, {
                details: err.message,
                data: {
                    filename: filename
                }
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
    var componentsDir;
    var that = this;

    if (this._installed) {
        return Q.resolve(this._installed);
    }

    // Gather all folders that are actual packages by
    // looking for the package metadata file
    componentsDir = path.join(this._config.cwd, this._config.directory);
    return this._installed = Q.nfcall(glob, '*/.bower.json', {
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

            filename = path.join(componentsDir, filename);

            // Read package metadata
            promise = Q.nfcall(fs.readFile, filename)
            .then(function (contents) {
                return JSON.parse(contents.toString());
            })
            .then(function (pkgMeta) {
                decEndpoints[name] = {
                    name: name,
                    source: pkgMeta._source,
                    target: pkgMeta._target, // TODO: this is wrong!
                    canonicalPkg: path.dirname(filename),
                    pkgMeta: pkgMeta
                };
            }, function (err) {
                throw createError('Something went wrong while reading ' + filename, err.code, {
                    details: err.message,
                    data: {
                        json: filename
                    }
                });
            });

            promises.push(promise);
        });

        // Wait until all files have been read
        // and resolve with the decomposed endpoints
        return Q.all(promises)
        .then(function () {
            return that._installed = decEndpoints;
        }.bind(this));
    });
};

Project.prototype._removePackages = function (packages, options) {
    var promises = [];

    mout.object.forOwn(packages, function (dir, name) {
        var promise;

        // Delete directory
        if (!dir) {
            promise = Q.resolve();
            this._logger.warn('not-installed', name, {
                name: name
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
        return mout.object.filter(packages, function (dir) {
            return !!dir;
        });
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
            compatible = this._manager.areCompatible(json, local);

            if (!compatible) {
                // Assign dependants to avoid extraneous warning
                local.dependants = local.dependants || {};
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
