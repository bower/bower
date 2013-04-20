var util = require('util');
var Q = require('q');
var Resolver = require('../Resolver');

var FsResolver = function (source, options) {
    Resolver.call(this, source, options);
};

util.inherits(FsResolver, Resolver);

// -----------------

FsResolver.prototype.hasNew = function (canonicalPkg) {
    // TODO: should we store latest modified files in the resolution and compare?
    return Q.resolve(true);
};

FsResolver.prototype._resolveSelf = function () {
    return this._copy()
    .then(this._extract.bind(this));
};

// -----------------

FsResolver.prototype._copy = function () {

};

FsResolver.prototype._extract = function () {

};

module.exports = FsResolver;