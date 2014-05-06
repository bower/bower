// jshint -W109, -W013
var semver = require('semver');
var mout = require('mout');
var Q = require('Q');
var createError = require('../util/createError');

function verbose(msg) {
    if (verbose.is) {
        console.log(msg);
    }
}

function getTargets(dependencies) {
    return mout.object.map(dependencies, function(dependency) {
        return dependency.replace(/.*?(#|$)/, '');
    });
}

function source(address) {
    return address.replace(/#.*/, '');
}

var versionCache = {};
function getVersions(repo, name, address) {
    if (versionCache[name]) return Q.resolve(versionCache[name]);

    address = semver.validRange(address) ? name: source(address);

    return repo.versions(address).then(function (versions) {
        versionCache[name] = versions.sort().reverse();
        verbose(('VERSIONS for ' + name + ' ' + versionCache[name]).replace(/,/g, ', '));
        return versionCache[name];
    });
}

var dependencyCache = {};
function getDeps(repo, name, ver, address) {
    if (dependencyCache[name+ver]) return Q.resolve(dependencyCache[name+ver]);

    return repo.fetch({
        name: name,
        source: source(address) || repo._config.cwd,
        target: ver || '*',
        canonicalDir: repo._config.cwd
    }).spread(function (canonicalDir, pkgMeta) {
        return (dependencyCache[name+ver] = pkgMeta.dependencies || {});
    });
}


function extendConstraints() {
    var newConstraints = {};
    for (var i in arguments) {
        var constraints = arguments[i] || {};
        mout.collection.forEach(constraints, function(constr, name) {
            newConstraints[name] = mout.array.unique((newConstraints[name] || []).concat(constr)).sort().reverse();
        });
    }
    return newConstraints;
}

function extendSolution(solutions, constraints) {
    var newSolution = {};
    if (!mout.collection.every(solutions, function(solution) {
        return mout.collection.every(solution, function(ver, name) {
            newSolution[name] = mout.array.find([].concat(newSolution[name], ver).sort().reverse(), function(version) {
                return mout.collection.every(constraints[name], function(constr) { return semver.satisfies(version, constr); });
            });

            return newSolution[name];
        });
    })) {
        return null;
    }

    return newSolution;
}

// should be bound with the Project instance as 'this'
function fullResolve(repo, dependencies, constraints) {
    var deferred = Q.defer();

    constraints = extendConstraints(constraints, getTargets(dependencies));

    var name = dependencies && Object.keys(dependencies)[0];
    if (name) {
        getVersions(repo, name, dependencies[name]).then(function (availableVersions) {
            availableVersions = availableVersions.concat();

            var tryNextVersion = function (err) { // NOTE, if err is provided then it is an unexpected error, rather than a normal rejection
                if (err) {
                    verbose(err);
                    deferred.reject(err);
                    return;
                }

                if (!availableVersions.length) {
                    verbose('REJECT ' + name);
                    deferred.reject();
                    return;
                }

                var version = availableVersions.shift();
                if (!mout.collection.every(constraints[name], function (constr) { return semver.satisfies(version, constr); })) {
                    return tryNextVersion();
                }

                getDeps(repo, name, version, dependencies[name]).then(function (deps) {
                    deps = deps || {};

                    verbose('TRY ' + name + ' v' + version);

                    function onResolve(result) {
                        var newConstraints = extendConstraints(constraints, result.constraints);

                        var thisSolution = {};
                        thisSolution[name] = version;

                        var newSolution = extendSolution([result.solution, thisSolution], newConstraints);
                        if (!newSolution) {
                            deferred.reject();
                            return;
                        }

                        deps = mout.object.mixIn({}, dependencies);
                        for (var key in newSolution) {
                            delete deps[key];
                        }

                        if (Object.keys(deps).length > 0) {
                            fullResolve(repo, deps, newConstraints).then(onResolve, tryNextVersion);
                        }
                        else {
                            deferred.resolve({ solution: newSolution, constraints: newConstraints });
                        }
                    }

                    fullResolve(repo, deps, constraints, name).then(onResolve, tryNextVersion);
                },
                function (e) {
                    verbose(e);
                    tryNextVersion();
                });
            };

            tryNextVersion();
        },
        function (e) {
            deferred.reject('Failed to get versions for "' + name + '". ' + e);
        });
    }
    else {
        deferred.resolve({ solution: {}, constraints: constraints });
    }

    return deferred.promise;
}

function publicFullResolve(json, installed, links) {
    if (!this._options.conservative) return Q.resolve([json, installed, links]);
    verbose.is = this._config.verbose;

    var deferred = Q.defer();
    var repo = this._manager.getPackageRepository();
    fullResolve(repo, json.dependencies, {}).then(function (result) {
        verbose('SOLUTION');
        verbose(result.solution);
        json.dependencies = mout.object.map(json.dependencies, function(address, name) { return source(address) + '#' + result.solution[name]; });
        deferred.resolve([json, installed, links]);
    },
    function (e) {
        deferred.reject(createError(e || 'Couldn\'t find a suitable combination', 'NOMATCH'));
    });

    this._manager._areCompatible = function (candidate, resolved) { return true; };
    this.saveJson = function() { return Q.resolve(); };

    return deferred.promise;
}

module.exports = publicFullResolve;