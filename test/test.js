// Cleanup the uncaughtException added by the tmp module
// It messes with the mocha uncaughtException event to caught errors
process.removeAllListeners('uncaughtException');

require('./resolve/resolver');
require('./resolve/resolvers/gitResolver');
require('./resolve/resolvers/gitFsResolver');
require('./resolve/resolvers/gitRemoteResolver');
require('./resolve/resolvers/fsResolver');
require('./resolve/worker');
//require('./resolve/resolverFactory');
