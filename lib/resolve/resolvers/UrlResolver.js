var util = require('util');
var Q = require('q');
var Resolver = require('../Resolver');

var UrlResolver = function (source, options) {
    Resolver.call(this, source, options);
};

util.inherits(UrlResolver, Resolver);

// -----------------

UrlResolver.prototype.hasNew = function (oldResolution) {
    // Store cache expiration headers in the resolution and compare them afterwards
    Q.resolve(true);
};

UrlResolver.prototype._resolveSelf = function () {
    return this._download()
    .then(this._extract.bind(this));
};

// -----------------

UrlResolver.prototype._download = function () {

};

UrlResolver.prototype._extract = function () {

};

module.exports = UrlResolver;