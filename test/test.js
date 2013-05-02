// Cleanup the uncaughtException added by the tmp module
// It messes with the mocha uncaughtException event to caught errors
// Please note that is the Resolver that calls tmp.setGracefulCleanup()
// so we need to require that before
require('../lib/resolve/Resolver');
process.removeAllListeners('uncaughtException');

require('./resolve/resolver');
require('./resolve/resolvers/urlResolver');
require('./resolve/resolvers/fsResolver');
require('./resolve/resolvers/gitResolver');
require('./resolve/resolvers/gitFsResolver');
require('./resolve/resolvers/gitRemoteResolver');
require('./resolve/resolverFactory');
require('./resolve/worker');
