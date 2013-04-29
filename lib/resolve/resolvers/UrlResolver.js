var util = require('util');
var Q = require('q');
var Resolver = require('../Resolver');

var UrlResolver = function (source, options) {
    Resolver.call(this, source, options);

    // TODO: if name was guessed, strip out the ?foo part
};

util.inherits(UrlResolver, Resolver);

// -----------------

UrlResolver.prototype.hasNew = function (oldResolution) {
    // Store cache expiration headers in the resolution and compare them afterwards
    Q.resolve(true);
};

UrlResolver.prototype._resolveSelf = function () {
    // TODO: use file mimetypes instead of extensions!
    return this._download()
    .then(this._extract.bind(this));
};

// -----------------

UrlResolver.prototype._download = function () {

};

UrlResolver.prototype._extract = function () {

};

module.exports = UrlResolver;