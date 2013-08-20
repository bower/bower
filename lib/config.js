var tty = require('tty');
var mout = require('mout');
var config = require('bower-config').read();
var cli = require('./util/cli');

// Delete the json attribute because it is no longer supported
// and conflicts with --json
delete config.json;

// If interactive is auto (null), guess its value
if (config.interactive == null) {
    config.interactive = process.title === 'bower' && tty.isatty(1);
}

// If cache is set, use it as the package cache. This allows the
// cache directory to be set by environment variable
if (config.cache) {
	config.storage.packages = config.cache;
	delete config.cache;
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
