var util = require('util');
var mout = require('mout');
var Resolver = require('../../../../lib/core/resolvers/resolver');

function TestResolver(decEndpoint, config, logger) {
    Resolver.call(this, decEndpoint, config, logger);
}

util.inherits(TestResolver, Resolver);
mout.object.mixIn(TestResolver, Resolver);

module.exports = TestResolver;
