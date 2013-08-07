var mout = require('mout');
var config = require('bower-config').read();
var cli = require('./util/cli');

// Delete the json attribute because it is no longer supported
// and conflicts with --json
delete config.json;

// If no userAgent is configured, use a generic one [in this case, curl] when using a proxy, 
// to avoid potential filtering on many corporate proxies with blank or unknown agents
if (config.proxy || config.httpsProxy) {
	config.userAgent = 'curl/7.21.4 (universal-apple-darwin11.0) libcurl/7.21.4 OpenSSL/0.9.8r zlib/1.2.5';
}

// Merge common CLI options into the config
mout.object.mixIn(config, cli.readOptions({
    force: { type: Boolean, shorthand: 'f' },
    offline: { type: Boolean, shorthand: 'o' },
    verbose: { type: Boolean, shorthand: 'V' },
    quiet: { type: Boolean, shorthand: 'q' },
    loglevel: { type: String, shorthand: 'l' },
    json: { type: Boolean, shorthand: 'j' },
    silent: { type: Boolean, shorthand: 's' }
}));

module.exports = config;
