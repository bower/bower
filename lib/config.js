var tty = require('tty');
var mout = require('mout');
var config = require('bower-config').read();
var cli = require('./util/cli');

var options;

// Delete the json attribute because it is no longer supported
// and conflicts with --json
delete config.json;

// Read CLI options
options = cli.readOptions({
    force: { type: Boolean, shorthand: 'f' },
    offline: { type: Boolean, shorthand: 'o' },
    verbose: { type: Boolean, shorthand: 'V' },
    quiet: { type: Boolean, shorthand: 'q' },
    loglevel: { type: String, shorthand: 'l' },
    json: { type: Boolean, shorthand: 'j' },
    silent: { type: Boolean, shorthand: 's' },
    // Non-CLI options, but needed bellow
    interactive: { type: Boolean }
});

// If interactive is auto (null), guess its value
if (config.interactive == null) {
    config.interactive = options.interactive != null ? options.interactive :
                         (process.title === 'bower' && tty.isatty(1));
}

// Merge common CLI options into the config
delete options.interactive;
mout.object.mixIn(config, options);

module.exports = config;
