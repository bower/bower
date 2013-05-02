var resolverFactory = require('./resolverFactory');
var config = require('../../config');

var PackageRepository = function (options) {
    options = options || {};

    this._offline = !!options.offline;
    this._config = options.config || config;
};

// -----------------

PackageRepository.prototype.get = function (endpoint) {
    // TODO: should query cache as soon as it is done!

    return resolverFactory(endpoint, this._options)
    .then(function (resolver) {
        return resolver.resolve();
    });
};

PackageRepository.prototype.abort = function () {
    // TODO
};

module.exports = PackageRepository;