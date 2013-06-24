var glob = require('glob');
var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
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
    return this._analyse()
    .spread(function (json, tree) {
        // Walk down the tree adding targets, resolved and incompatibles
        that._walkTree(tree, function (node, name) {
            if (node.missing || node.linked) {
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
                targets.push(decEndpoint);
                // Mark as unresolvable so that a conflict for
                // this target always require a choice
                decEndpoint.unresolvable = true;
            });
        }

        // Bootstrap the process
        return that._bootstrap(targets, resolved, incompatibles);
    })
    .then(function (installed) {
        // Handle save and saveDev options
        if (options.save || options.saveDev) {
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

        // Save JSON, might contain changes to dependencies and resolutions
        return that._saveJson()
        .then(function () {
            return installed;
        });
    })
    .fin(function () {
        that._installed = null;
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
    return this._analyse()
    .spread(function (json, tree, flattened) {
        // If no names were specified, update every package
        if (!names) {
            // Mark each root dependency as targets
            that._walkTree(tree, function (node) {
                targets.push(node);
                return false;
            }, true);

            // Mark extraneous as targets
            mout.object.forOwn(flattened, function (decEndpoint) {
                if (decEndpoint.extraneous) {
                    targets.push(decEndpoint);
                }
            });
        // Otherwise, selectively update the specified ones
        } else {
            // Error out if some of the specified names
            // are not installed
            names.forEach(function (name) {
                if (!flattened[name]) {
                    throw createError('Package ' + name + ' is not installed', 'ENOTINS', {
                        name: name
                    });
                }
            });

            // Walk down the tree adding missing, incompatible
            // and resolved
            that._walkTree(tree, function (node, name) {
                if (node.missing || node.linked) {
                    targets.push(node);
                } else if (node.incompatible) {
                    incompatibles.push(node);
                } else {
                    resolved[name] = node;
                }
            }, true);

            // Add root packages whose names are specified to be updated
            that._walkTree(tree, function (node, name) {
                if (!node.missing && !node.linked && names.indexOf(name) !== -1) {
                    targets.push(node);
                }
            }, true);

            // Mark extraneous whose names are specified to be updated
            mout.object.forOwn(flattened, function (decEndpoint, name) {
                if (decEndpoint.extraneous && names.indexOf(name) !== -1) {
                    targets.push(decEndpoint);
                }
            });
        }

        // Bootstrap the process
        return that._bootstrap(targets, resolved, incompatibles)
        .then(function (installed) {
            // Save JSON, might contain changes to resolutions
            return that._saveJson()
            .then(function () {
                return installed;
            });
        });
    })
    .fin(function () {
        that._installed = null;
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
    return this._analyse()
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
                var message;
                var data;
                var dependantsNames;
                var dependants = [];

                // Walk the down the tree, gathering dependants of the package
                that._walkTree(tree, function (node, nodeName) {
                    if (name === nodeName) {
                        dependants.push.apply(dependants, mout.object.values(node.dependants));
                    }
                }, true);

                // Remove duplicates
                dependants = mout.array.unique(dependants);

                // Note that the root is filtered from the dependants
                // as well as other dependants marked to be uninstalled
                dependants = dependants.filter(function (dependant) {
                    return !decEndpoint.root && names.indexOf(dependant.name) === -1;
                });

                // If the package has no dependants or the force config is enabled,
                // mark it to be removed
                if (!dependants.length || that._config.force) {
                    packages[name] = decEndpoint.canonicalDir;
                    return;
                }

                // Otherwise we need to figure it out if the user really wants to remove it,
                // even with dependants
                // As such we need to prompt the user with a meaningful message
                dependantsNames = dependants
                .map(function (dep) {
                    return dep.name;
                })
                .sort(function (name1, name2) {
                    return name1.localeCompare(name2);
                });

                dependantsNames = mout.array.unique(dependantsNames);
                message = dependantsNames.join(', ') + ' depends on ' + decEndpoint.name;
                data = {
                    name: decEndpoint.name,
                    dependants: dependants
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
                        packages[name] = decEndpoint.canonicalDir;
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
        that._installed = null;
        that._working = false;
    });
};

Project.prototype.getTree = function () {
    return this._analyse()
    .spread(function (json, tree, flattened) {
        var extraneous = [];

        tree = this._manager.toData(tree, ['missing', 'incompatible', 'linked']);
        tree.root = true;

        mout.object.forOwn(flattened, function (pkg) {
            if (pkg.extraneous) {
                extraneous.push(this._manager.toData(pkg));
            }
        }, this);

        return [tree, flattened, extraneous];
    }.bind(this));
};

Project.prototype.getJson = function () {
    return this._readJson();
};

// -----------------

Project.prototype._analyse = function () {
    return Q.all([
        this._readJson(),
        this._readInstalled(),
        this._readLinks()
    ])
    .spread(function (json, installed, links) {
        var root;
        var flattened = mout.object.mixIn({}, installed, links);

        root = {
            name: json.name,
            source: this._config.cwd,
            target: json.version || '*',
            pkgMeta: json,
            canonicalDir: this._config.cwd,
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

                // Warn about extraneous only if a json file exists
                if (this._jsonFile) {
                    release = decEndpoint.pkgMeta._release;
                    this._logger.log('warn', 'extraneous', decEndpoint.name + (release ? '#' + release : ''), this._manager.toData(decEndpoint));
                }
            }
        }, this);

        // Remove root from the flattened tree
        delete flattened[json.name];

        return [json, root, flattened];
    }.bind(this));
};

Project.prototype._bootstrap = function (targets, resolved, incompatibles) {
    var installed = mout.object.map(this._installed, function (decEndpoint) {
        return decEndpoint.pkgMeta;
    });

    this._json.resolutions = this._json.resolutions || {};

    // Configure the manager and kick in the resolve process
    return this._manager
    .configure({
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
        var jsonStr = JSON.stringify(json, null, '  ');
        that._jsonHash = crypto.createHash('md5').update(jsonStr).digest('hex');
        return that._json = json;
    });
};

Project.prototype._saveJson = function () {
    var jsonStr = JSON.stringify(this._json, null, '  ');
    var jsonHash = crypto.createHash('md5').update(jsonStr).digest('hex');

    // Save only if there's something different
    if (jsonHash === this._jsonHash) {
        return Q.resolve();
    }

    if (!this._jsonFile) {
        this._logger.warn('no-json', 'No bower.json file to save to');
        return Q.resolve();
    }

    return Q.nfcall(fs.writeFile, this._jsonFile, jsonStr)
    .then(function () {
        this._jsonHash = jsonHash;
    }.bind(this));
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
        var promises;
        var decEndpoints = {};

        // Foreach bower.json found
        promises = filenames.map(function (filename) {
            var name = path.dirname(filename);

            filename = path.join(componentsDir, filename);

            // Read package metadata
            return Q.nfcall(fs.readFile, filename)
            .then(function (contents) {
                return JSON.parse(contents.toString());
            })
            .then(function (pkgMeta) {
                decEndpoints[name] = {
                    name: name,
                    source: pkgMeta._source,
                    target: pkgMeta._target,
                    canonicalDir: path.dirname(filename),
                    pkgMeta: pkgMeta
                };
            // Ignore if failed to read file
            }, function () {});
        });

        // Wait until all files have been read
        // and resolve with the decomposed endpoints
        return Q.all(promises)
        .then(function () {
            return that._installed = decEndpoints;
        });
    });
};

Project.prototype._readLinks = function () {
    var componentsDir;

    // Read directory, looking for links
    componentsDir = path.join(this._config.cwd, this._config.directory);
    return Q.nfcall(fs.readdir, componentsDir)
    .then(function (filenames) {
        var promises;
        var decEndpoints = {};

        // Filter only those that are links
        promises = filenames.map(function (filename) {
            var dir = path.join(componentsDir, filename);

            return Q.nfcall(fs.lstat, dir)
            .then(function (stat) {
                if (stat.isSymbolicLink()) {
                    decEndpoints[filename] = {
                        name: filename,
                        source: dir,
                        target: '*',
                        canonicalDir: dir,
                        pkgMeta: {
                            name: filename
                        },
                        linked: true
                    };
                }
            });
        });

        // Wait until all links have been read
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
            this._logger.warn('not-installed', name, {
                name: name
            });
        } else {
            promise = Q.nfcall(rimraf, dir);
            this._logger.action('uninstall', name, {
                name: name,
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
    var dependencies;

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
        dependencies = mout.object.values(node.dependencies);
        // If onlyOnce was true, do not add if already traversed
        if (onlyOnce) {
            dependencies = dependencies.filter(function (dependency) {
                return onlyOnce.indexOf(dependency) === -1;
            });
        }

        queue.unshift.apply(queue, dependencies);
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
        var restored;
        var compatible;

        // Check if the dependency is not installed
        if (!local) {
            flattened[key] = restored = json;
            restored.missing = true;
        // Even if it is installed, check if it's compatible
        } else {
            compatible = json.target === '*' || this._manager.areCompatible(json, local);
            if (!compatible) {
                restored = json;
                restored.incompatible = true;

                if (!local.missing) {
                    restored.pkgMeta = local.pkgMeta;
                    restored.canonicalDir = local.canonicalDir;
                } else {
                    restored.missing = true;
                }
            } else {
                restored = local;
                mout.object.mixIn(local, json);
            }
        }

        // Cross reference
        node.dependencies[key] = restored;
        restored.dependants = restored.dependants || {};
        restored.dependants[node.name] = node;

        // Call restore for this dependency
        this._restoreNode(restored, flattened, jsonKey);

        // Do the same for the incompatible local package
        if (local && restored !== local) {
            this._restoreNode(local, flattened, jsonKey);
        }
    }, this);
};

module.exports = Project;
