var Q = require('q');
var util = require('util');
var mout = require('mout');
var events = require('events');

var UnitOfWork = function (options) {
    // Ensure options defaults
    this._options = mout.object.mixIn({
        maxConcurrent: 5
    }, options);

    // Parse some of the options
    this._options.maxConcurrent = this._options.maxConcurrent > 0 ? this._options.maxConcurrent : 0;

    // Initialize some needed properties
    this._queue = [];
    this._beingResolved = [];
};

util.inherits(UnitOfWork, events.EventEmitter);

// -----------------

UnitOfWork.prototype.enqueue = function (resolver) {
    var deferred;

    if (this.has(resolver)) {
        throw new Error('Attempting to enqueue an already enqueued resolver');
    }

    deferred = Q.defer();

    // Add to the queue
    this._queue.push({
        resolver: resolver,
        deferred: deferred
    });

    // Process the queue shortly later so that handlers can be attached to the returned promise
    Q.fcall(this.doWork.bind(this));

    return deferred.promise;
};

UnitOfWork.prototype.has = function (resolver) {
    var index;

    // Check in the queue
    index = this._indexOf(this._queue, resolver);
    if (index !== -1) {
        return true;
    }

    // Check in the being resolved list
    index = this._indexOf(this._beingResolved, resolver);
    if (index !== -1) {
        return true;
    }

    return false;
};

UnitOfWork.prototype.abort = function () {
    var promises,
        emptyFunc = function () {};

    // Empty queue
    this._queue = [];

    // Wait for pending resolvers to resolve
    promises = this._beingResolved.map(function (entry) {
        // Please note that the promise resolution/fail is silenced
        return entry.deferred.promise.then(emptyFunc, emptyFunc);
    });

    return Q.all(promises);
};

// -----------------

UnitOfWork.prototype._doWork = function () {
    // Check if the number of allowed packages being resolved reached the maximum
    if (this._options.maxConcurrent && this._beingResolved.length >= this._options.maxConcurrent) {
        return;
    }

    // Find candidates for the free slots
    var freeSlots = this._options.maxConcurrent ? this._options.maxConcurrent - this._beingResolved.length : -1,
        entry,
        resolver,
        x;

    for (x = 0; x < this._queue.length && freeSlots; ++x) {
        entry = this._queue[x];
        resolver = entry.resolver;

        // Remove from the queue and
        this._queue.splice(x--, 1);

        // Put it in the being resolved list
        this._beingResolved.push(entry);
        freeSlots--;

        // Resolve it, waiting for it to be done
        this.emit('pre_resolve', resolver);
        resolver.resolve().then(this._onResolveSuccess.bind(this, entry), this._onResolveFailure.bind(this, entry));
    }
};

UnitOfWork.prototype._onResolveSuccess = function (entry, result) {
    var index;

    // Remove the package from the being resolved list
    index = this._beingResolved.indexOf(entry);
    this._beingResolved.splice(index, 1);

    entry.deferred.resolve(result);
    this.emit('post_resolve', entry.resolver, result);

    // A free spot became available, so let's do some more work
    this._doWork();
};

UnitOfWork.prototype._onResolveFailure = function (entry, err) {
    var index;

    // Remove the package from the being resolved list
    index = this._beingResolved.indexOf(entry);
    this._beingResolved.splice(index, 1);

    entry.deferred.reject(err);
    this.emit('fail', entry.resolver, err);

    // A free spot became available, so let's do some more work
    this._doWork();
};

UnitOfWork.prototype._indexOf = function (arr, pkg) {
    return mout.array.findIndex(arr, function (item) {
        return item.pkg === pkg;
    });
};

module.exports = UnitOfWork;