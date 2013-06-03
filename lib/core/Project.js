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
    var targets = {};
    var resolved = {};
    var installed;

    // If already working, error out
    if (this._working) {
        return Q.reject(createError('Already working', 'EWORKING'));
    }

    options = options || {};
    this._production = !!options.production;

    // If no endpoints were specified, simply repair the project
    // Note that we also repair incompatible packages
    if (!endpoints) {
        return this._repair(true)
        .fin(function () {
            that._working = false;
        });
    }

    // Start by repairing the project, installing only missing packages
    return this._repair()
    // Analyse the project
    .then(that.analyse.bind(this))
    .spread(function (json, tree, flattened) {
        // Mark targets
        endpoints.forEach(function (endpoint) {
            var decEndpoint = endpointParser.decompose(endpoint);
            targets[decEndpoint.name] = decEndpoint;
        });

        // Mark every package from the tree as resolved
        // if it's not a target or a non-shared descendant of a target
        // This is done by walking the tree (deep first) and abort traversal
        // as soon as one target was found
        that._walkTree(tree, function (node, name) {
            if (targets[name]) {
                return false;  // Abort traversal
            }

            resolved[name] = node.pkgMeta;
        });

        installed = mout.object.map(flattened, function (decEndpoint) {
            return decEndpoint.pkgMeta;
        });
    })
    // Bootstrap the process
    .then(function () {
        return that._bootstrap(targets, resolved, installed);
    })
    // Handle save and saveDev options
    .then(function (installed) {
        if (!options.save && !options.saveDev) {
            return;
        }

        // Cycle through the initial targets and not the installed
        // ones because some targets could already be installed
        mout.object.forOwn(targets, function (decEndpoint) {
            var source = decEndpoint.registry ? '' : decEndpoint.source;
            var target = decEndpoint.pkgMeta.version ? '~' + decEndpoint.pkgMeta.version : decEndpoint.target;
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
    var targets;
    var resolved;
    var installed;
    var repaired;
    var promise;

    // If already working, error out
    if (this._working) {
        return Q.reject(createError('Already working', 'EWORKING'));
    }

    options = options || {};
    this._production = !!options.production;

    // If no names were specified, we update every package
    if (!names) {
        // Analyse the project
        promise = this.analyse()
        .spread(function (json, tree, flattened) {
            // Mark each json entry as targets
            targets = mout.object.map(json.dependencies, function (value, key) {
                return endpointParser.json2decomposed(key, value);
            });

            // Mark installed
            installed = mout.object.map(flattened, function (decEndpoint) {
                return decEndpoint.pkgMeta;
            });
        });
    // Otherwise we selectively update the specified ones
    } else {
        // Start by repairing the project
        // Note that we also repair incompatible packages
        promise = this._repair(true)
        // Analyse the project
        .then(function (result) {
            repaired = result;
            return that.analyse();
        })
        .spread(function (json, tree, flattened) {
            targets = {};
            resolved = {};

            // Mark targets
            names.forEach(function (name) {
                var decEndpoint = flattened[name];
                var jsonEntry;

                if (!decEndpoint) {
                    throw createError('Package ' + name + ' is not installed', 'ENOTINSTALLED');
                }

                // If it was repaired, don't include in the targets
                if (repaired[name]) {
                    return;
                }

                // Use json entry if available, fallbacking to the installed one
                jsonEntry = json.dependencies && json.dependencies[name];
                if (jsonEntry) {
                    targets[name] = endpointParser.json2decomposed(name, jsonEntry);
                } else {
                    targets[name] = decEndpoint;
                }
            });

            // Mark every package from the tree as resolved
            // if it's not a target or a non-shared descendant of a target
            that._walkTree(tree, function (node, name) {
                if (targets[name]) {
                    return false;  // Abort traversal
                }

                resolved[name] = node.pkgMeta;
            });

            // Mark installed
            installed = mout.object.map(flattened, function (decEndpoint) {
                return decEndpoint.pkgMeta;
            });
        });
    }

    // Bootstrap the process
    return promise.then(function () {
        return that._bootstrap(targets, resolved, installed);
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
            root: true
        };

        // Restore the original dependencies cross-references,
        // that is, the parent-child relationships
        this._restoreNode(root, flattened);
        // Do the same for the dev dependencies
        if (!this._production) {
            this._restoreNode(root, flattened, 'devDependencies');
        }

        // Parse extraneous
        mout.object.forOwn(flattened, function (decEndpoint) {
            if (!decEndpoint.dependants) {
                decEndpoint.extraneous = true;

                // Restore it
                this._restoreNode(decEndpoint, flattened);
                // Do the same for the dev dependencies
                if (!this._production) {
                    this._restoreNode(decEndpoint, flattened, 'devDependencies');
                }
            }
        }, this);

        // The package meta set above is not really a package meta
        // so we delete it from the root
        // Also remove it from the flattened tree
        delete root.pkgMeta;
        delete flattened[json.name];

        return [json, root, flattened];
    }.bind(this));
};

// -----------------

Project.prototype._bootstrap = function (targets, resolved, installed) {
    // Configure the manager and kick in the resolve process
    return this._manager
    .configure(mout.object.values(targets), resolved, installed)
    .resolve()
    // Install resolved ones
    .then(function () {
        return this._manager.install();
    }.bind(this));
};

Project.prototype._repair = function (incompatible) {
    var that = this;

    return this.analyse()
    .spread(function (json, tree, flattened) {
        var targets = [];
        var resolved = {};
        var isBroken = false;

        // Figure out which are the missing/incompatible ones
        // by parsing the flattened tree
        mout.object.forOwn(flattened, function (decEndpoint, name) {
            if (decEndpoint.missing) {
                targets.push(decEndpoint);
                isBroken = true;
            } else if (incompatible && decEndpoint.incompatible) {
                targets.push(decEndpoint);
                isBroken = true;
            } else if (!decEndpoint.extraneous) {
                resolved[name] = decEndpoint.pkgMeta;
            }
        });

        // Do not proceed if the project does not need to be repaired
        if (!isBroken) {
            return {};
        }

        // Configure the manager and kick in the resolve process
        return that._bootstrap(targets, resolved);
    });
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

Project.prototype._walkTree = function (node, fn) {
    var queue = mout.object.values(node.dependencies);
    var result;

    while (queue.length) {
        node = queue.shift();
        result = fn(node, node.name);

        if (result === false) {
            continue;
        }

        queue.unshift.apply(queue, mout.object.values(node.dependencies));
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

    mout.object.forOwn(node.pkgMeta[jsonKey || 'dependencies'], function (value, key) {
        var local = flattened[key];
        var json = endpointParser.json2decomposed(key, value);

        // Check if the dependency is not installed
        if (!local) {
            flattened[key] = local = json;
            local.missing = true;
        // Even if it is installed, check if it's compatible
        } else if (!local.incompatible && !local.missing && !this._manager.areCompatible(local.pkgMeta.version || '*', json.target)) {
            json.pkgMeta = local.pkgMeta;
            flattened[key] = local = json;
            local = json;
            local.incompatible = true;
        }

        // Cross reference
        node.dependencies[key] = local;
        local.dependants = local.dependants || {};
        local.dependants[node.name] = node;

        // Call restore for this dependency
        this._restoreNode(local, flattened);
    }, this);
};

module.exports = Project;
