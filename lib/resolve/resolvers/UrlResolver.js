var util = require('util');
var Q = require('q');
var Resolver = require('../Resolver');

var UrlResolver = function (endpoint, options) {
    Resolver.call(this, endpoint, options);
};

util.inherits(UrlResolver, Resolver);

// -----------------

UrlResolver.prototype._resolveSelf = function () {
    var promise;

    console.log('_resolveSelf of url resolver');
    promise = this._download()
    .then(this._extract.bind(this));

    return promise;
};

UrlResolver.prototype._download = function () {
    var deferred = Q.defer();

    console.log('_download');
    setTimeout(function () {
        deferred.resolve();
    }, 1000);

    return deferred.promise;
};

UrlResolver.prototype._extract = function () {
    var deferred = Q.defer();

    // If the file extension is not a zip and a tar, resolve the promise on next tick

    console.log('_extract');
    setTimeout(function () {
        deferred.resolve();
    }, 1000);

    return deferred.promise;
};

module.exports = UrlResolver;