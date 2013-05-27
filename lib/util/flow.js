var Q = require('q');

// Similar to Q.all but also propagates progress events
function all(promises) {
    var deferred = Q.defer();

    promises.forEach(function (promise) {
        if (promise && promise.progress) {
            promise.progress(deferred.notify);
        }
    });

    Q.all(promises)
    .then(deferred.resolve, deferred.reject);

    return deferred.promise;
}

// Similar to Q.allResolved but also propagates progress events
function allResolved(promises) {
    var deferred = Q.defer();

    promises.forEach(function (promise) {
        if (promise && promise.progress) {
            promise.progress(deferred.notify);
        }
    });

    Q.allResolved(promises)
    .then(deferred.resolve, deferred.reject);

    return deferred.promise;
}

module.exports.all = all;
module.exports.allResolved = allResolved;
