var util = require('util');
var Q = require('q');
var Package = require('../Package');

var GitFsPackage = function (endpoint, options) {
    Package.call(this, endpoint, options);
};

util.inherits(GitFsPackage, Package);

// -----------------

GitFsPackage.prototype._resolveSelf = function () {
    var promise;

    console.log('_resolveSelf of git local package');
    promise = this._copy()
    .then(this._fetch.bind(this))
    .then(this._versions.bind(this))
    .then(this._checkout.bind(this));

    return promise;
};

GitFsPackage.prototype._copy = function () {
    // create temporary folder
    // copy over
};

GitFsPackage.prototype._fetch = function () {
    // fetch origin
    // reset --hard
};

GitFsPackage.prototype._versions = function () {
    // retrieve versions
};

GitFsPackage.prototype._checkout = function () {
    // resolve range to a specific version and check it out
};

module.exports = GitFsPackage;
