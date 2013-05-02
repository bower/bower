var config = require('../../config');

var Manager = function (options) {
    options = options || {};

    this._offline = !!options.offline;
    this._config = options.config || config;
};

// -----------------

module.exports = Manager;