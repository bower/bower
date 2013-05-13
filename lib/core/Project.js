var glob = require('glob');
var path = require('path');
var fs = require('fs');
var Q = require('q');
var mout = require('mout');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var bowerJson = require('bower-json');
var semver = require('semver');
var Manager = require('./Manager');
var defaultConfig = require('../config');
var createError = require('../util/createError');
var endpointParser = require('../util/endpointParser');
var copy = require('../util/copy');

var Project = function (options) {
    options = options || {};

    this._config = options.config || defaultConfig;
    this._manager = new Manager(options);
};

Project.prototype.install = function (endpoints) {
    // If already working, error out
    if (this._working) {
        return Q.reject(createError('Already working', 'EWORKING'));
    }

    // If an empty array was passed, null it out
    if (endpoints && !endpoints.length) {
        endpoints = null;
    }

    // Collect local, json and specified endpoints
    // TODO: Q.all seems to not propagate notifications..
    return Q.all([
        this._collectLocal(),
        this._collectFromJson(),
        this._collectFromEndpoints(endpoints)
    ])
    .spread(function (locals, jsons, endpoints) {
        var toBeResolved = [];
        var resolved = [];

        // If endpoints were passed
        if (endpoints) {
            // Mark each of the endpoint to be resolved
            mout.object.forOwn(endpoints, function (decEndpoint) {
                toBeResolved.push(decEndpoint);
            }, this);

            // Mark locals as resolved if they were not specified as endpoints
            // and if they are specified in the jsons
            mout.object.forOwn(locals, function (decEndpoint) {
                if (jsons[decEndpoint.name] && !endpoints[decEndpoint.name]) {
                    resolved.push(decEndpoint);
                }
            }, this);
        // Otherwise use jsons
        } else {
            // Mark jsons to be resolved if they are not installed
            // Even if they are installed, its semver must match
            // against the installed ones

            // TODO: If the user deletes a deep dependency this won't work out
            //       Find a better solution
            mout.object.forOwn(jsons, function (decEndpoint) {
                var local = locals[decEndpoint.name];

                if (!local || !this._manager.areCompatible(local, decEndpoint)) {
                    toBeResolved.push(decEndpoint);
                } else {
                    resolved.push(local);
                }
            }, this);
        }

        // Configure the manager with the targets and resolved
        // endpoints
        this._manager.configure(toBeResolved, resolved);

        // Kick in the resolve process
        return this._manager.resolve();
    }.bind(this))
    .then(this._copyResolved.bind(this))
    .fin(function () {
        this._working = false;
    }.bind(this));
};

Project.prototype.update = function (names, options) {

};

Project.prototype.uninstall = function (names, options) {

};

Project.prototype.list = function (options) {

};

// -----------------

Project.prototype._copyResolved = function (decEndpoints) {
    var destDir = path.join(this._config.cwd, this._config.directory);
    var deferred = Q.defer();

    Q.nfcall(mkdirp, destDir)
    .then(function () {
        var promises = [];

        mout.object.forOwn(decEndpoints, function (decEndpoint) {
            var promise;
            var dest;
            var release = decEndpoint.json._release;

            // Do not copy if already installed (local)
            if (decEndpoint.local) {
                return;
            }

            deferred.notify({
                type: 'action',
                data: 'Installing' + (release ? ' "' + release + '"' : ''),
                from: decEndpoint.name || decEndpoint.resolverName,
                endpoint: decEndpoint
            });

            dest = path.join(destDir, decEndpoint.name);

            // Remove existent
            promise = Q.nfcall(rimraf, dest)
            // Copy dir
            .then(copy.copyDir.bind(copy, decEndpoint.dir, dest));

            promises.push(promise);
        });

        return Q.all(promises);
    })
    .then(deferred.resolve, deferred.reject, deferred.notify);

    return deferred.promise;
};

Project.prototype._collectFromJson = function () {
    var deferred = Q.defer();

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
    }.bind(this), function () {
        // No json file was found, assume one
        return Q.nfcall(bowerJson.parse, { name: this._name });
    })
    // For each dependency, decompose the endpoint, generating
    // an object which keys are package names and values the decomposed
    // endpoints
    .then(function (json) {
        var name;
        var decEndpoint;
        var decEndpoints = {};

        for (name in json.dependencies) {
            decEndpoint = endpointParser.decompose(json.dependencies[name]);

            // Check if source is a semver version/range
            // If so, the endpoint is probably a registry entry
            if (semver.valid(decEndpoint.source) != null || semver.validRange(decEndpoint.source) != null) {
                decEndpoint.target = decEndpoint.source;
                decEndpoint.source = name;
            }

            // Ensure name of the endpoint based on the key
            decEndpoint.name = name;

            decEndpoints[name] = decEndpoint;
        }

        return decEndpoints;
    })
    .then(deferred.resolve, deferred.reject, deferred.notify);

    return deferred.promise;
};

Project.prototype._collectFromEndpoints = function (endpoints) {
    var decEndpoints;

    if (!endpoints) {
        return Q.resolve();
    }

    decEndpoints = {};
    endpoints.forEach(function (endpoint) {
        var decEndpoint = endpointParser.decompose(endpoint);
        decEndpoints[decEndpoint.name] = decEndpoint;
    });

    return Q.resolve(decEndpoints);
};

Project.prototype._collectLocal = function () {
    var componentsDir = path.join(this._config.cwd, this._config.directory);

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

                // Set decomposed endpoint manually
                return {
                    name: name,
                    source: path.join(componentsDir, name),
                    target: json.version || '*',
                    json: json,
                    local: true
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

module.exports = Project;