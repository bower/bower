var glob = require('glob');
var path = require('path');
var fs = require('fs');
var Q = require('q');
var mout = require('mout');
var bowerJson = require('bower-json');
var Manager = require('./Manager');
var defaultConfig = require('../config');
var createError = require('../util/createError');
var endpointParser = require('../util/endpointParser');
var F = require('../util/flow');

function Project(config) {
    this._config = config || defaultConfig;
    this._manager = new Manager(this._config);
}

// -----------------

Project.prototype.install = function (endpoints, options) {
    var that = this;

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
    .then(that._analyse.bind(this))
    .spread(function (json, tree, flattened) {
        var targets = {};
        var resolved = {};
        var installed;

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

        // Bootstrap the process
        return that._bootstrap(targets, resolved, installed)
        // Handle save and saveDev options
        .then(function () {
            var key;

            if (!options.save && !options.saveDev) {
                return;
            }

            key = options.save ? 'dependencies' : 'devDependencies';
            that._json[key] = that._json[key] || {};

            mout.object.forOwn(targets, function (decEndpoint) {
                var source = decEndpoint.source === decEndpoint.registryName ? '' : decEndpoint.source;
                var target = decEndpoint.pkgMeta.version ? '~' + decEndpoint.pkgMeta.version : decEndpoint.target;
                that._json[key][decEndpoint.name] = mout.string.ltrim(source + '#' + target, ['#']);
            });

            return that._saveJson()
            .progress(function (notification) {
                return notification;
            });
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
        promise = this._analyse()
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
            return that._analyse();
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

                // Use json entry if available,
                // fallbacking to the installed one
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

};

Project.prototype.getTree = function () {

};

// -----------------

Project.prototype._analyse = function () {
    return F.all([
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
            dir: this._config.cwd,
            pkgMeta: json
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
            }
        });

        return [json, root, flattened];
    }.bind(this));
};

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

    return this._analyse()
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
    var deferred;

    if (this._json) {
        return Q.resolve(this._json);
    }

    deferred = Q.defer();

    // Read local json
    this._json = Q.nfcall(bowerJson.find, this._config.cwd)
    .then(function (filename) {
        // If it is a component.json, warn about the deprecation
        if (path.basename(filename) === 'component.json') {
            process.nextTick(function () {
                deferred.notify({
                    level: 'warn',
                    id: 'deprecated',
                    message: 'You are using the deprecated component.json file',
                    data: {
                        json: filename
                    }
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
        that._json = json;
        deferred.resolve(json);
    }, deferred.reject, deferred.notify);

    return deferred.promise;
};

Project.prototype._saveJson = function (json) {
    var deferred = Q.defer();

    if (!this._jsonFile) {
        process.nextTick(function () {
            deferred.notify({
                level: 'warn',
                id: 'no-json',
                message: 'No bower.json file to save to'
            });
            deferred.resolve();
        });
    } else {
        json = json || this._json;

        Q.nfcall(fs.writeFile, this._jsonFile, JSON.stringify(json, null, '  '))
        .then(deferred.resolve, deferred.reject, deferred.notify);
    }

    return deferred.promise;
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
                    target: pkgMeta.version,
                    dir: path.dirname(jsonFile),
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

Project.prototype._walkTree = function (node, fn) {
    var queue = [node];
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
    node.dependants = {};

    mout.object.forOwn(node.pkgMeta[jsonKey || 'dependencies'], function (value, key) {
        var local = flattened[key];
        var json = endpointParser.json2decomposed(key, value);

        // Check if the dependency is not installed
        if (!local) {
            flattened[key] = local = json;
            local.missing = true;
        // Even if it is installed, check if it's compatible
        } else if (!local.incompatible && !this._manager.areCompatible(local.pkgMeta.version || '*', json.target)) {
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
