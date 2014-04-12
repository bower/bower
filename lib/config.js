var tty = require('tty');
var mout = require('mout');
var config = require('bower-config').read();
var cli = require('./util/cli');

// Delete the json attribute because it is no longer supported
// and conflicts with --json
delete config.json;

// If interactive is auto (null), guess its value
if (config.interactive == null) {
    config.interactive = (
        process.bin === 'bower' &&
        tty.isatty(1) &&
        !process.env.CI
    );
}

// If `analytics` hasn't been explicitly set, we disable
// it when ran programatically.
if (config.analytics == null) {
    // Don't enable analytics on CI server unless explicitly configured.
    config.analytics = config.interactive;
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
