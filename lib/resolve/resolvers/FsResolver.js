var util = require('util');
var Q = require('q');
var Resolver = require('../Resolver');

var FsResolver = function (endpoint, options) {
    Resolver.call(this, endpoint, options);
};

util.inherits(FsResolver, Resolver);

// -----------------

FsResolver.prototype._resolveSelf = function () {
    var promise;

    console.log('_resolveSelf of fs resolver');
    promise = this.copy()
    .then(this._extract.bind(this));

    return promise;
};

FsResolver.prototype._copy = function () {
    var deferred = Q.defer();

    console.log('_download');
    setTimeout(function () {
        deferred.resolve();
    }, 1000);

    return deferred.promise;
};

FsResolver.prototype._extract = function () {
    var deferred = Q.defer();

    // If the file extension is not a zip and a tar, resolve the promise on next tick

    console.log('_extract');
    setTimeout(function () {
        deferred.resolve();
    }, 1000);

    return deferred.promise;
};

module.exports = FsResolver;