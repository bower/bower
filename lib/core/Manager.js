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
var F = require('../util/flow');

function Manager(config) {
    this._config = config || defaultConfig;
    this._repository = new PackageRepository(config);
}

// -----------------

Manager.prototype.configure = function (targets, resolved, installed) {
    // If working, error out
    if (this._working) {
        throw createError('Can\'t configure while working', 'EWORKING');
    }

    this._targets = {};
    this._resolved = {};
    this._installed = {};

    // Parse targets
    targets.forEach(function (decEndpoint) {
        this._targets[decEndpoint.name] = decEndpoint;
    }, this);

    // Parse resolved
    mout.object.forOwn(resolved, function (value, name) {
        // TODO: If value is a string, read package meta
        //       If is not a string, than it's already the package meta
        this._resolved[name] = [{
            name: name,
            source: value._source,
            target: value.version || '*',
            pkgMeta: value,
            initial: true
        }];

        this._installed[name] = value;
    }, this);

    // Parse installed
    mout.object.mixIn(this._installed, installed);

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

    // If there's nothing to resolve, simply dissect
    if (mout.lang.isEmpty(this._targets)) {
        process.nextTick(this._dissect.bind(this));
    // Otherwise, fetch each target from the repository
    // and let the process roll out
    } else {
        mout.object.forOwn(this._targets, this._fetch.bind(this));
    }

    // Unset working flag when done
    return this._deferred.promise
    .fin(function () {
        this._working = false;
    }.bind(this));
};

Manager.prototype.install = function () {
    var destDir;
    var deferred;
    var that = this;

    // If already resolving, error out
    if (this._working) {
        return Q.reject(createError('Already working', 'EWORKING'));
    }

    destDir = path.join(this._config.cwd, this._config.directory);
    deferred = Q.defer();

    Q.nfcall(mkdirp, destDir)
    .then(function () {
        var promises = [];

        mout.object.forOwn(that._dissected, function (decEndpoint, name) {
            var promise;
            var dest;
            var release = decEndpoint.pkgMeta._release;

            deferred.notify(that._extendNotification({
                level: 'action',
                id: 'install',
                message: name + (release ? '#' + release : ''),
                data: {
                    pkgMeta: decEndpoint.pkgMeta
                }
            }, decEndpoint));

            // Remove existent and copy canonical package
            dest = path.join(destDir, name);
            promise = Q.nfcall(rimraf, dest)
            .then(copy.copyDir.bind(copy, decEndpoint.dir, dest))
            .fail(function (err) {
                throw that._extendNotification(err, decEndpoint);
            });

            promises.push(promise);
        });

        return F.all(promises);
    })
    .then(function () {
        // Resolve with an object where keys are names and values
        // are the package metas
        return mout.object.map(that._dissected, function (decEndpoint) {
            return decEndpoint.pkgMeta;
        });
    })
    .then(deferred.resolve, deferred.reject, deferred.notify);

    // Unset working flag when done
    return deferred.promise
    .fin(function () {
        this._working = false;
    }.bind(this));
};

Manager.prototype.areCompatible = function (first, second) {
    var validFirst = semver.valid(first) != null;
    var validSecond = semver.valid(second) != null;
    var validRangeFirst;
    var validRangeSecond;
    var highestSecond;
    var highestFirst;

    // Version -> Version
    if (validFirst && validSecond) {
        return semver.eq(first, second);
    }

    // Range -> Version
    validRangeFirst = semver.validRange(first) != null;
    if (validRangeFirst && validSecond) {
        return semver.satisfies(second, first);
    }

    // Version -> Range
    validRangeSecond = semver.validRange(second) != null;
    if (validFirst && validRangeSecond) {
        return semver.satisfies(first, second);
    }

    // Range -> Range
    if (validRangeFirst && validRangeSecond) {
        // Special case which both targets are *
        if (first === '*' && second === '*') {
            return true;
        }

        // Grab the highest version possible for both
        highestSecond = this._findHighestVersion(semver.toComparators(second));
        highestFirst = this._findHighestVersion(semver.toComparators(first));

        // Check if the highest resolvable version for the
        // second is the same as the first one
        return semver.eq(highestSecond, highestFirst);
    }

    // As fallback, check if both are the equal
    return first === second;
};

// -----------------

Manager.prototype._fetch = function (decEndpoint) {
    var name = decEndpoint.name;
    var deferred = this._deferred;
    var that = this;

    // Mark as being fetched
    this._fetching[name] = this._fetching[name] || [];
    this._fetching[name].push(decEndpoint);
    this._nrFetching++;

    // Fetch it from the repository
    // Note that the promise is stored in the decomposed endpoint
    // because it might be reused if a similar endpoint needs to be resolved
    decEndpoint.promise = this._repository.fetch(decEndpoint)
    // When done, call onFetch
    .spread(this._onFetch.bind(this, deferred, decEndpoint))
    // If it fails, we make the whole process to error out
    .fail(function (err) {
        that._extendNotification(err, decEndpoint);
        deferred.reject(err);
    })
    // Listen to progress to proxy them to the resolve deferred
    // Note that we also mark where the notification is coming from
    .progress(function (notification) {
        that._extendNotification(notification, decEndpoint);
        deferred.notify(notification);
    });

    return decEndpoint.promise;
};

Manager.prototype._onFetch = function (deferred, decEndpoint, canonicalPkg, pkgMeta) {
    var name;
    var resolved;
    var index;
    var initialName = decEndpoint.name;

    // If the deferred associated with the process is already rejected,
    // do not proceed.
    if (deferred.promise.isRejected()) {
        return;
    }

    // Remove from being fetched list
    mout.array.remove(this._fetching[initialName], decEndpoint);
    this._nrFetching--;

    // Store some needed stuff
    decEndpoint.name = name = decEndpoint.name || pkgMeta.name;
    decEndpoint.dir = canonicalPkg;
    decEndpoint.pkgMeta = pkgMeta;

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
    this._parseDependencies(decEndpoint, pkgMeta);

    // If the resolve process ended, parse the resolved packages
    // to find the most suitable version for each package
    if (this._nrFetching <= 0) {
        process.nextTick(this._dissect.bind(this));
    }
};

Manager.prototype._parseDependencies = function (decEndpoint, pkgMeta) {
    // Parse package dependencies
    mout.object.forOwn(pkgMeta.dependencies, function (value, key) {
        var resolved;
        var beingFetched;
        var compatible;
        var childDecEndpoint = endpointParser.json2decomposed(key, value);

        // Check if a compatible one is already resolved
        // If there's one, we don't need to resolve it twice
        resolved = this._resolved[key];
        if (resolved) {
            compatible = mout.array.find(resolved, function (resolved) {
                return this.areCompatible(resolved.target, childDecEndpoint.target);
            }, this);

            // Simply mark it as resolved
            if (compatible) {
                childDecEndpoint.dir = compatible.dir;
                childDecEndpoint.pkgMeta = compatible.pkgMeta;
                this._resolved[key].push(childDecEndpoint);
                return;
            }
        }

        // Check if a compatible one is being fetched
        // If there's one, we reuse it to avoid resolving it twice
        beingFetched = this._fetching[key];
        if (beingFetched) {
            compatible = mout.array.find(beingFetched, function (beingFetched) {
                return this.areCompatible(beingFetched.target, childDecEndpoint.target);
            }, this);

            // Wait for it to resolve and then add it to the resolved packages
            if (compatible) {
                childDecEndpoint = compatible.promise.then(function () {
                    childDecEndpoint.dir = compatible.dir;
                    childDecEndpoint.pkgMeta = compatible.pkgMeta;
                    this._resolved[key].push(childDecEndpoint);
                }.bind(this));

                return;
            }
        }

        // Otherwise, just fetch it from the repository
        this._fetch(childDecEndpoint);
    }, this);
};

Manager.prototype._dissect = function () {
    var suitables = {};

    mout.object.forOwn(this._resolved, function (decEndpoints, name) {
        var nonSemver;
        var validSemver;
        var suitable;
        var target = mout.object.get(this._targets, name + '.target');

        // If this was initially configured as a target without a valid semver target,
        // it means the user wants it regardless of other ones
        if (target && semver.valid(target) == null && semver.validRange(target) == null) {
            suitables[name] = this._targets[name];
            // TODO: issue warning
            return;
        }

        // Filter non-semver ones
        nonSemver = decEndpoints.filter(function (decEndpoint) {
            return !decEndpoint.pkgMeta.version;
        });

        // Filter semver ones
        validSemver = decEndpoints.filter(function (decEndpoint) {
            return !!decEndpoint.pkgMeta.version;
        });

        // Sort semver ones
        validSemver.sort(function (first, second) {
            if (semver.gt(first, second)) {
                return -1;
            }
            if (semver.lt(first, second)) {
                return 1;
            }

            // If it gets here, they are equal but priority is given to
            // installed ones
            return first.initial ? -1 : (second.initial ? 1 : 0);
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
                    return semver.satisfies(subject.pkgMeta.version, decEndpoint.target);
                });
            });
        }

        // TODO: handle case which there is a suitable version but there are no-semver ones too
        if (suitable) {
            suitables[name] = suitable;
        } else {
            throw new Error('No suitable version for "' + name + '"');
        }
    }, this);

    // Filter only packages that need to be installed
    this._dissected = mout.object.filter(suitables, function (decEndpoint, name) {
        var installedMeta = this._installed[name];
        return !installedMeta || installedMeta._release !== decEndpoint.pkgMeta._release;
    }, this);

    // Resolve just with the package metas of the dissected object
    this._deferred.resolve(mout.object.map(this._dissected, function (decEndpoint) {
        return decEndpoint.pkgMeta;
    }));
};

Manager.prototype._extendNotification = function (notification, decEndpoint) {
    // Add endpoint to the data
    notification.data = notification.data || {};
    notification.data.endpoint = {
        name: decEndpoint.name,
        source: decEndpoint.source,
        target: decEndpoint.target
    };

    // Add from
    notification.from = decEndpoint.name || decEndpoint.registryName;
    if (!notification.from && notification.data.resolver) {
        notification.from = notification.data.resolver.getName();
    }

    return notification;
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
