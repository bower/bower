var util = require('util');
var Q = require('q');
var Package = require('../Package');

var GitRemotePackage = function (endpoint, options) {
    Package.call(this, endpoint, options);
};

util.inherits(GitRemotePackage, Package);

// -----------------

GitRemotePackage.prototype._resolveSelf = function () {
    var promise;

    console.log('_resolveSelf of git remote package');
    promise = this._clone()
    .then(this._fetch.bind(this))
    .then(this._versions.bind(this))
    .then(this._checkout.bind(this));

    return promise;
};

GitRemotePackage.prototype._clone = function () {
    // check cache
    // clone only if not cached
    var deferred = Q.defer();

    console.log('_clone');
    setTimeout(function () {
        deferred.resolve();
    }, 1000);

    return deferred.promise;
};

GitRemotePackage.prototype._fetch = function () {
    // fetch origin with --prune
    // reset --hard origin/HEAD
    var deferred = Q.defer();

    console.log('_fetch');
    setTimeout(function () {
        deferred.resolve();
    }, 1000);

    return deferred.promise;
};

GitRemotePackage.prototype._versions = function () {
    // retrieve versions
    var deferred = Q.defer();

    console.log('_versions');
    setTimeout(function () {
        deferred.resolve();
    }, 1000);

    return deferred.promise;
};

GitRemotePackage.prototype._checkout = function () {
    // resolve range to a specific version and check it out
    var deferred = Q.defer();

    console.log('_checkout');
    setTimeout(function () {
        deferred.resolve();
    }, 1000);

    return deferred.promise;
};

module.exports = GitRemotePackage;
