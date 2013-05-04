var resolverFactory = require('./resolverFactory');
var config = require('../../config');

var PackageRepository = function (options) {
    options = options || {};

    this._offline = !!options.offline;
    this._force = !!options.force;
    this._config = options.config || config;
};

// -----------------

PackageRepository.prototype.get = function (decEndpoint) {
    return resolverFactory(decEndpoint, {
        skipCache: this._force
    })
    .then(function (resolver) {
        return resolver.resolve();
    });
};

PackageRepository.prototype.abort = function () {
    // TODO
};

module.exports = PackageRepository;