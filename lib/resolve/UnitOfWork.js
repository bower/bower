var Q = require('q');
var util = require('util');
var mout = require('mout');
var events = require('events');
var createError = require('../util/createError');

var UnitOfWork = function (options) {
    // Ensure options defaults
    this._options = mout.object.mixIn({
        failFast: true,
        maxConcurrent: 5
    }, options);

    // Parse some of the options
    this._options.failFast = !!this._options.failFast;
    this._options.maxConcurrent = this._options.maxConcurrent > 0 ? this._options.maxConcurrent : 0;

    // Initialize some needed properties
    this._queue = [];
    this._beingResolved = [];
    this._beingResolvedEndpoints = {};
    this._resolved = {};
    this._failed = {};
    this._completed = {};
};

util.inherits(UnitOfWork, events.EventEmitter);

// -----------------

UnitOfWork.prototype.enqueue = function (pkg) {
    var deferred = Q.defer(),
        index;

    // Throw it if already queued
    index = this._indexOf(this._queue, pkg);
    if (index !== -1) {
        throw new Error('Package is already queued');
    }

    // Throw if already resolving
    index = this._indexOf(this._beingResolved, pkg);
    if (index !== -1) {
        throw new Error('Package is already being resolved');
    }

    // Add to the queue
    this._queue.push({
        pkg: pkg,
        deferred: deferred
    });
    this.emit('enqueue', pkg);

    // Process the queue shortly later so that handlers can be attached to the returned promise
    Q.fcall(this._processQueue.bind(this));

    return deferred.promise;
};

UnitOfWork.prototype.dequeue = function (pkg) {
    var index;

    // Throw if the package is already is being resolved
    index = this._indexOf(this._beingResolved, pkg);
    if (index !== -1) {
        throw new Error('Package is already being resolved');
    }

    // Attempt to remove from the queue
    index = this._indexOf(this._queue, pkg);
    if (index !== -1) {
        this._queue.splice(index, 1);
        this.emit('dequeue', pkg);
    }

    return this;
};

UnitOfWork.prototype.getResolved = function (name) {
    return name ? this._resolved[name] || [] : this._resolved;
};

UnitOfWork.prototype.getFailed = function (name) {
    return name ? this._failed[name] || [] : this._failed;
};

// -----------------

UnitOfWork.prototype._processQueue = function () {
    // If marked to fail all, reject everything
    if (this._failAll) {
        return this._rejectAll();
    }

    // Check if the number of allowed packages being resolved reached the maximum
    if (this._options.maxConcurrent && this._beingResolved.length >= this._options.maxConcurrent) {
        return;
    }

    // Find candidates for the free spots
    var freeSpots = this._options.maxConcurrent ? this._options.maxConcurrent - this._beingResolved.length : -1,
        endpoint,
        duplicate,
        entry,
        x;

    for (x = 0; x < this._queue.length && freeSpots; ++x) {
        entry = this._queue[x];
        endpoint = entry.pkg.getEndpoint();

        // Skip if there is a package being resolved with the same endpoint
        if (this._beingResolvedEndpoints[endpoint]) {
            continue;
        }

        // Remove from the queue
        this._queue.splice(x--, 1);
        this.emit('dequeue', entry.pkg);

        // Check if the exact same package has been resolved (same endpoint and range)
        // If so, we reject the promise with an appropriate error
        duplicate = this._findDuplicate(entry.pkg);
        if (duplicate) {
            entry.deferred.reject(createError('Package with same endpoint and range was already resolved', 'EDUPL', { pkg: duplicate }));
            continue;
        }

        // Package is ok to resolve
        // Put it in the being resolved list
        this._beingResolved.push(entry);
        this._beingResolvedEndpoints[endpoint] = true;

        // Decrement the free spots available
        freeSpots--;

        // Resolve the promise to let the package know that it can proceed
        this.emit('before_resolve', entry.pkg);
        entry.deferred.resolve(this._onPackageDone.bind(this, entry.pkg));
    }
};

UnitOfWork.prototype._rejectAll = function () {
    var error,
        queue;

    // Reset the queue and being resolved list
    queue = this._queue;
    this._queue = [];
    this._beingResolved = [];
    this._beingResolvedEndpoints = {};

    // Reject every deferred
    error = createError('Package rejected to be resolved', 'EFFAST');
    queue.forEach(function (entry) {
        entry.deferred.reject(error);
    });
};

UnitOfWork.prototype._onPackageDone = function (pkg, err) {
    var pkgName = pkg.getName(),
        pkgEndpoint = pkg.getEndpoint(),
        arr,
        index;

    // Ignore if already completed
    if (this._completed[pkgEndpoint] && this._completed[pkgEndpoint].indexOf(pkg) !== -1) {
        return;
    }

    // Add it as completed
    arr = this._completed[pkgEndpoint] = this._completed[pkgEndpoint] || [];
    arr.push(pkg);

    // Remove the package from the being resolved list
    index = this._indexOf(this._beingResolved, pkg);
    this._beingResolved.splice(index, 1);
    delete this._beingResolvedEndpoints[pkg.getEndpoint()];

    // If called with no error then add it as resolved
    if (!err) {
        arr = this._resolved[pkgName] = this._resolved[pkgName] || [];
        arr.push(pkg);
        this.emit('resolve', pkg);
    // Otherwise, it failed to resolve so we mark it as failed
    } else {
        arr = this._failed[pkgName] = this._failed[pkgName] || [];
        arr.push(pkg);
        this.emit('failed', pkg);

        // If fail fast is enabled, make every other package in the queue to fail
        this._failAll = this._options.failFast;
    }

    // Call process queue in order to allow packages to take over the free spots in the queue
    this._processQueue();
};

UnitOfWork.prototype._indexOf = function (arr, pkg) {
    return mout.array.findIndex(arr, function (item) {
        return item.pkg === pkg;
    });
};

UnitOfWork.prototype._findDuplicate = function (pkg) {
    var arr = this._completed[pkg.getEndpoint()];

    if (!arr) {
        return null;
    }

    return mout.array.find(arr, function (item) {
        return item.getRange() === pkg.getRange();
    });
};

module.exports = UnitOfWork;