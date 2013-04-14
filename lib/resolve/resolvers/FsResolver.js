var util = require('util');
var Q = require('q');
var Resolver = require('../Resolver');

var FsResolver = function (endpoint, options) {
    Resolver.call(this, endpoint, options);
};

util.inherits(FsResolver, Resolver);

// -----------------

FsResolver.prototype._resolveSelf = function () {
    return this._copy()
    .then(this._extract.bind(this));
};

FsResolver.prototype._copy = function () {

};

FsResolver.prototype._extract = function () {

};

module.exports = FsResolver;