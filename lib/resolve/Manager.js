var config = require('../../config');

var Manager = function (options) {
    options = options || {};

    this._offline = !!options.offline;
    this._config = options.config || config;
};

// -----------------

Manager.prototype.install = function (endpoints) {
    this._packages = {};

    // If some endpoints were passed, use those
    // Otherwise grab the ones specified in the json

    // Check which packages are already installed
    // and not install those if the target range is matched

    // Query the PackageRepository
    // TODO
};

module.exports = Manager;