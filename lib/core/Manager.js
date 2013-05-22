var Q = require('q');
var mout = require('mout');
var semver = require('semver');
var path = require('path');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var PackageRepository = require('./PackageRepository');
var defaultConfig = require('../config');
var copy = require('../util/copy');
var createError = require('../util/createError');
var endpointParser = require('../util/endpointParser');

var Manager = function (options) {
    options = options || {};

    this._config = options.config || defaultConfig;
    this._repository = new PackageRepository(options);
};

Manager.prototype.configure = function (unresolved, resolved) {
    // If working, error out
    if (this._working) {
        throw createError('Can\'t configure while working', 'EWORKING');
    }

    // Store stuff
    this._targets = unresolved;
    this._resolved = {};

    mout.object.forOwn(resolved, function (decEndpoint) {
        // Only accept resolved endpoints with a name
        if (!decEndpoint.name || !decEndpoint.dir || !decEndpoint.json) {
            throw createError('The properties "name", "dir" and "json" must be set when configuring resolved endpoints');
        }

        this._resolved[decEndpoint.name] = [decEndpoint];

        // Add a flag that mark this endpoint as configured initially
        decEndpoint.initial = true;
    }, this);

    return this;
};

Manager.prototype.resolve = function () {
    // If already resolving, error out
    if (this._working) {
        return Q.reject(createError('Already working', 'EWORKING'));
    }

    // Reset stuff
    this._fetching = {};
    this._nrFetching = 0;
    this._failed = {};

    this._deferred = Q.defer();

    // If there's nothing to resolve, simply finish the process
    if (mout.lang.isEmpty(this._targets)) {
        process.nextTick(this._finish.bind(this));
    }

    // Foreach endpoint, fetch it from the repository
    mout.object.forOwn(this._targets, this._fetch.bind(this));

    return this._deferred.promise
    .fin(function () {
        this._working = false;
    }.bind(this));
};

Manager.prototype.install = function () {
    var destDir;
    var deferred;

    // If already resolving, error out
    if (this._working) {
        return Q.reject(createError('Already working', 'EWORKING'));
    }

    destDir = path.join(this._config.cwd, this._config.directory);
    deferred = Q.defer();

    Q.nfcall(mkdirp, destDir)
    .then(function () {
        var promises = [];

        mout.object.forOwn(this._dissected, function (decEndpoint) {
            var promise;
            var dest;
            var release = decEndpoint.json._release;

            // Do not copy if it was initially configured as resolved
            if (decEndpoint.initial) {
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
    }.bind(this))
    .then(function () {
        this._working = false;
        deferred.resolve(this._dissected);
    }.bind(this), deferred.reject, deferred.notify);

    return deferred.promise;
};

Manager.prototype.areCompatible = function (source, subject) {
    var validSource = semver.valid(source.target) != null;
    var validSubject = semver.valid(subject.target) != null;
    var validRangeSource = semver.validRange(source.target) != null;
    var validRangeSubject = semver.validRange(subject.target) != null;

    var highestSubject;
    var highestSource;

    // Version -> Version
    if (validSource && validSubject) {
        return semver.eq(source.target, subject.target);
    }

    // Range -> Version
    if (validRangeSource && validSubject) {
        return semver.satisfies(subject.target, source.target);
    }

    // Version -> Range
    if (validSource && validRangeSubject) {
        return semver.satisfies(source.target, subject.target);
    }

    // Range -> Range
    if (validRangeSource && validRangeSubject) {
        // Special case which both targets are *
        if (source.target === '*' && subject.target === '*') {
            return true;
        }

        // Grab the highest version possible for both
        highestSubject = this._findHighestVersion(semver.toComparators(subject.target));
        highestSource = this._findHighestVersion(semver.toComparators(source.target));

        // Check if the highest resolvable version for the
        // subject is the same as the source one
        return semver.eq(highestSubject, highestSource);
    }

    // Otherwise check if both targets are the same
    return source.target === subject.target;
};

// -----------------

Manager.prototype._fetch = function (decEndpoint) {
    var name = decEndpoint.name;

    // Mark as being fetched
    this._fetching[name] = this._fetching[name] || [];
    this._fetching[name].push(decEndpoint);
    this._nrFetching++;

    // Fetch it from the repository
    // Note that the promise is stored in the decomposed endpoint
    // because it might be reused if a similar endpoint needs to be resolved
    decEndpoint.promise = this._repository.fetch(decEndpoint)
    // When done, call onFetch
    .spread(this._onFetch.bind(this, decEndpoint))
    // Listen to progress to proxy them to the resolve deferred
    // Note that we mark where the notification is coming from
    .progress(function (notification) {
        notification.endpoint = decEndpoint;
        notification.from = decEndpoint.name || decEndpoint.resolverName;
        this._deferred.notify(notification);
    }.bind(this));

    return decEndpoint.promise;
};

Manager.prototype._onFetch = function (decEndpoint, canonicalPkg, pkgMeta) {
    var json;
    var name;
    var resolved;
    var index;
    var initialName = decEndpoint.name;

    // Remove from being fetched list
    mout.array.remove(this._fetching[initialName], decEndpoint);
    this._nrFetching--;

    // Set the name, dir, json property in the decomposed endpoint
    decEndpoint.dir = canonicalPkg;
    decEndpoint.name = name = decEndpoint.name || pkgMeta.name;
    decEndpoint.json = json = pkgMeta;

    // Add to the resolved list, marking it as resolved
    resolved = this._resolved[name] = this._resolved[name] || [];
    resolved.push(decEndpoint);
    delete decEndpoint.promise;

    // If the fetched package was an initial target and had no name,
    // we need to remove the initially resolved one that match the new name
    if (!initialName) {
        index = mout.array.findIndex(resolved, function (decEndpoint) {
            return decEndpoint.initial;
        });

        if (index !== -1) {
            resolved.splice(index, 1);
        }
    }

    // Parse dependencies
    this._parseDependencies(decEndpoint, json);

    // If the resolve process ended, parse the resolved packages
    // to find the most suitable version for each package
    if (this._nrFetching <= 0) {
        process.nextTick(this._finish.bind(this));
    }
};

Manager.prototype._parseDependencies = function (decEndpoint, json) {
    // Parse package dependencies
    mout.object.forOwn(json.dependencies, function (value, key) {
        var decEndpoints;
        var compatible;
        var childDecEndpoint = endpointParser.json2decomposed(key, value);

        // Check if a compatible one is already resolved
        // If there's one, we don't need to resolve it twice
        decEndpoints = this._resolved[key];
        if (decEndpoints) {
            compatible = mout.array.find(decEndpoints, function (resolved) {
                return this.areCompatible(resolved, childDecEndpoint);
            }, this);

            // Simply mark it as resolved
            if (compatible) {
                childDecEndpoint.dir = compatible.dir;
                childDecEndpoint.json = compatible.json;
                this._resolved[key].push(childDecEndpoint);
                return;
            }
        }

        // Check if a compatible one is being fetched
        // If there's one, we reuse it to avoid resolving it twice
        decEndpoints = this._fetching[key];
        if (decEndpoints) {
            compatible = mout.array.find(decEndpoints, function (beingFetched) {
                return this.areCompatible(beingFetched, childDecEndpoint);
            }, this);

            // Wait for it to resolve and then add it to the resolved packages
            if (compatible) {
                childDecEndpoint = compatible.promise.then(function () {
                    childDecEndpoint.dir = compatible.dir;
                    childDecEndpoint.json = compatible.json;
                    this._resolved[key].push(childDecEndpoint);
                }.bind(this));

                return;
            }
        }

        // Otherwise, just fetch it from the repository
        this._fetch(childDecEndpoint);
    }, this);
};

Manager.prototype._finish = function () {
    this._dissected = {};

    mout.object.forOwn(this._resolved, function (decEndpoints, name) {
        var configured = this._targets[name];
        var nonSemver;
        var validSemver;
        var suitable;

        // If this was initially configured as a target without a valid semver target,
        // it means the user wants it regardless of other ones
        if (configured && configured.target && !semver.valid(configured.target)) {
            this._dissected[name] = this._targets[name];
            // TODO: issue warning
            return;
        }

        // Filter non-semver ones
        nonSemver = decEndpoints.filter(function (decEndpoint) {
            return !decEndpoint.json.version;
        });

        // Filter semver ones
        validSemver = decEndpoints.filter(function (decEndpoint) {
            return !!decEndpoint.json.version;
        });

        // Sort semver ones
        validSemver.sort(function (first, second) {
            if (semver.gt(first, second)) {
                return -1;
            }
            if (semver.lt(first, second)) {
                return 1;
            }
            return 0;
        });

        // If there are no semver targets
        if (!validSemver.length) {
            // TODO: if various non-semver were found, resolve conflicts
            suitable = nonSemver[0];
        // Otherwise, find most suitable semver
        } else {
            // TODO: handle conflicts if there is no suitable version
            suitable = mout.array.find(validSemver, function (subject) {
                return validSemver.every(function (decEndpoint) {
                    return semver.satisfies(subject.json.version, decEndpoint.target);
                });
            });
        }

        // TODO: handle case which there is a suitable version but there are no-semver ones too

        if (suitable) {
            this._dissected[name] = suitable;
        } else {
            throw new Error('No suitable version for "' + name + '"');
        }
    }, this);

    this._deferred.resolve(this._dissected);
};

Manager.prototype._findHighestVersion = function (comparators) {
    var highest;
    var matches;
    var version;

    comparators.forEach(function (comparator) {
        // Get version of this comparator
        // If it's an array, call recursively
        if (Array.isArray(comparator)) {
            version = this._findHighestVersion(comparator);
        // Otherwise extract the version from the comparator
        // using a simple regexp
        } else {
            matches = comparator.match(/\d+\.\d+\.\d+.*$/);
            if (!matches) {
                return;
            }

            version = matches[0];
        }

        // Compare with the current highest version
        if (!highest || semver.gt(version, highest)) {
            highest = version;
        }
    }, this);

    return highest;
};

module.exports = Manager;