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

function Project(options) {
    options = options || {};

    this._options = options;
    this._config = options.config || defaultConfig;
    this._manager = new Manager(options);
}

// -----------------

Project.prototype.install = function (endpoints) {
    var repairResult;
    var that = this;

    // If already working, error out
    if (this._working) {
        return Q.reject(createError('Already working', 'EWORKING'));
    }

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
    .then(function (result) {
        repairResult = result;
        return that._analyse();
    })
    .spread(function (json, tree, flattened) {
        var targetNames = {};
        var targets = [];
        var installed = {};

        // Mark targets
        endpoints.forEach(function (target) {
            var decEndpoint = endpointParser.decompose(target);
            targetNames[decEndpoint.name] = true;
            targets.push(decEndpoint);
        });

        // Mark every package from the tree as installed
        // if they are not a target or a non-shared descendant of a target
        // TODO: We should traverse the tree (deep first) and
        //       add each leaf to the resolved
        //       If a leaf is a target, we abort traversal of it
        mout.object.forOwn(flattened, function (decEndpoint, name) {
            if (targetNames[name]) {
                return;
            }

            installed[name] = decEndpoint.pkgMeta;
        });

        // Configure the manager and kick in the resolve process
        return that._manager
        .configure(targets, installed)
        .resolve()
        // Install resolved ones
        .then(function () {
            return that._manager.install();
        })
        // Resolve the promise with the repair and install results,
        // by merging them together
        .then(function (result) {
            return mout.object.fillIn(result, repairResult);
        });
    })
    .fin(function () {
        that._working = false;
    });
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
        var flattened = installed;

        root = {
            name: json.name,
            pkgMeta: json
        };

        // Restore the original dependencies cross-references,
        // that is, the parent-child relationships
        this._restoreNode(root, flattened);
        // Do the same for the dev dependencies
        if (!this._options.production) {
            this._restoreNode(root, flattened, 'devDependencies');
        }

        return [json, root, flattened];
    }.bind(this));
};

Project.prototype._repair = function (incompatible) {
    var that = this;

    return this._analyse()
    .spread(function (json, tree, flattened) {
        var targets = [];
        var installed = {};
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
            } else {
                installed[name] = decEndpoint.pkgMeta;
            }
        });

        // Do not proceed if the project does not need to be repaired
        if (!isBroken) {
            return {};
        }

        // Configure the manager and kick in the resolve process
        return that._manager
        .configure(targets, installed)
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
                    level: 'warn',
                    tag: 'deprecated',
                    json: filename,
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
        var decEndpoints = {};

        // Foreach bower.json found
        filenames.forEach(function (filename) {
            var promise;
            var name = path.dirname(filename);

            // Read package metadata
            promise = Q.nfcall(fs.readFile, path.join(componentsDir, filename))
            .then(function (contents) {
                var pkgMeta = JSON.parse(contents.toString());

                decEndpoints[name] = {
                    name: name,
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
            local = json;
            local.missing = true;
            flattened[key] = local;
        // Even if it is installed, check if it's compatible
        } else if (!local.incompatible && !this._manager.areCompatible(local.pkgMeta.version || '*', json.target)) {
            json.pkgMeta = local.pkgMeta;
            local = json;
            local.incompatible = true;
            flattened[key] = local;
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
