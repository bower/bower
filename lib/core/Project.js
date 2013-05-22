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

var Project = function (options) {
    options = options || {};

    this._options = options;
    this._config = options.config || defaultConfig;
    this._manager = new Manager(options);
};

Project.prototype.install = function (targets) {
    var that = this;
    var repairDissected;

    // If already working, error out
    if (this._working) {
        return Q.reject(createError('Already working', 'EWORKING'));
    }

    // If no targets were specified, simply repair the project if necessary
    // Note that we also repair incompatible packages
    if (!targets) {
        return this._repair(true)
        .fin(function () {
            that._working = false;
        }.bind(this));
    }

    // Start by repairing the project, installing any missing packages
    return this._repair()
    // Analyse the project
    .then(function (dissected) {
        repairDissected = dissected;
        return that._analyse();
    })
    // Decide which dependencies should be fetched and the ones
    // that are already resolved
    .spread(function (json, tree, flattened) {
        var unresolved = {};
        var resolved = {};

        // Mark targets as unresolved
        targets.forEach(function (target) {
            unresolved[target.name] = endpointParser.decompose(target);
        });

        // Mark every package from the tree as resolved
        // if they are not a target or a non-shared descendant of a target
        // TODO: We should do traverse the tree (vertically) and
        //       add each leaf to the resolved
        //       If a leaf is a target, we abort traversal of it
        resolved = mout.object.filter(flattened, function (decEndpoint, name) {
            return !unresolved[name];
        });

        // Configure the manager with the unresolved and resolved endpoints
        // And kick in the resolve process
        return that._manager
        .configure(unresolved, resolved)
        .resolve()
        // Install resolved ones
        .then(function () {
            return that._manager.install();
        })
        // Resolve with the repair and install dissection
        .then(function (dissected) {
            return mout.object.fillIn(dissected, repairDissected);
        });
    })
    .fin(function () {
        that._working = false;
    }.bind(this));
};

Project.prototype.update = function (names) {

};

Project.prototype.uninstall = function (names, options) {

};

Project.prototype.getTree = function () {

};

Project.prototype.getFlatTree = function () {

};

// -----------------

Project.prototype._analyse = function () {
    // TODO: Q.all seems to not propagate notifications..
    return Q.all([
        this._readJson(),
        this._readInstalled()
    ])
    .spread(function (json, installed) {
        var root;

        root = {
            name: json.name,
            source: this._config.cwd,
            target: json.version || '*',
            json: json,
            dir: this._config.cwd
        };

        // Restore the original dependencies cross-references,
        // that is, the parent-child relationships
        this._restoreNode(root, installed);
        // Do the same for the dev dependencies
        if (!this._options.production) {
            this._restoreNode(root, installed, 'devDependencies');
        }
        return [json, root, installed];
    }.bind(this));
};

Project.prototype._repair = function (incompatible) {
    var that = this;

    return this._analyse()
    .spread(function (json, tree, flattened) {
        var unresolved = {};
        var resolved = {};
        var isBroken = false;

        // Figure out which are the missing/incompatible ones
        // by parsing the flattened tree
        mout.object.forOwn(flattened, function (decEndpoint, name) {
            if (decEndpoint.missing) {
                unresolved[name] = decEndpoint;
                isBroken = true;
            } else if (incompatible && decEndpoint.incompatible) {
                unresolved[name] = decEndpoint;
                isBroken = true;
            } else {
                resolved[name] = decEndpoint;
            }
        });

        // Do not proceed if the project does not need to be repaired
        if (!isBroken) {
            return {};
        }

        // Configure the manager with the unresolved and resolved endpoints
        // And kick in the resolve process
        return that._manager
        .configure(unresolved, resolved)
        .resolve()
        // Install after resolve
        .then(function () {
            return that._manager.install();
        });
    });
};

Project.prototype._readJson = function () {
    var deferred = Q.defer();

    // TODO: refactor!

    // Read local json
    Q.nfcall(bowerJson.find, this._config.cwd)
    .then(function (filename) {
        // If it is a component.json, warn about the deprecation
        if (path.basename(filename) === 'component.json') {
            process.nextTick(function () {
                deferred.notify({
                    type: 'warn',
                    data: 'You are using the deprecated component.json file'
                });
            });
        }

        // Read it
        return Q.nfcall(bowerJson.read, filename)
        .fail(function (err) {
            throw createError('Something went wrong while reading "' + filename + '"', err.code, {
                details: err.message
            });
        });
    }, function () {
        // No json file was found, assume one
        return Q.nfcall(bowerJson.parse, { name: path.basename(this._config.cwd) });
    }.bind(this))
    .then(deferred.resolve, deferred.reject, deferred.notify);

    return deferred.promise;
};

Project.prototype._readInstalled = function () {
    var componentsDir = path.join(this._config.cwd, this._config.directory);

    // TODO: refactor
    // Gather all folders that are actual packages by
    // looking for the package metadata file
    return Q.nfcall(glob, '*/.bower.json', {
        cwd: componentsDir,
        dot: true
    })
    .then(function (filenames) {
        var promises = [];

        // Foreach bower.json found
        filenames.forEach(function (filename) {
            var promise;
            var name = path.dirname(filename);

            // Read package metadata
            promise = Q.nfcall(fs.readFile, path.join(componentsDir, filename))
            .then(function (contents) {
                var json = JSON.parse(contents.toString());
                var dir = path.join(componentsDir, name);

                // Set decomposed endpoint manually
                return {
                    name: name,
                    source: dir,
                    target: json.version || '*',
                    json: json,
                    dir: dir
                };
            });

            promises.push(promise);
        });

        // Wait until all files have been read
        // to form the final object of decomposed endpoints
        return Q.all(promises)
        .then(function (locals) {
            var decEndpoints = {};

            locals.forEach(function (decEndpoint) {
                decEndpoints[decEndpoint.name] = decEndpoint;
            });

            return decEndpoints;
        });
    });
};

Project.prototype._restoreNode = function (node, locals, jsonKey) {
    // Do not restore if already processed or if the node is
    // missing or incompatible
    if (node.dependencies || node.missing || node.incompatible) {
        return;
    }

    node.dependencies = {};

    mout.object.forOwn(node.json[jsonKey || 'dependencies'], function (value, key) {
        var local = locals[key];
        var json = endpointParser.json2decomposed(key, value);

        // Check if the dependency is installed
        if (!local) {
            local = endpointParser.json2decomposed(key, value);
            local.missing = true;
            locals[key] = local;
        // If so, also check if it's compatible
        } else if (!this._manager.areCompatible(local, json)) {
            local.incompatible = true;
            locals[key] = json;
        }

        // Cross reference
        node.dependencies[key] = local;
        local.dependants = local.dependants || {};
        local.dependants[node.name] = node;

        // Call restore for this dependency
        this._restoreNode(local, locals);
    }, this);
};

module.exports = Project;