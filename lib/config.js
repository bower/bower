var mout = require('mout');
var config = require('bower-config').read();
var cli = require('./util/cli');

// Merge common CLI options into the config
mout.object.mixIn(config, cli.readOptions({
    force: { type: Boolean, shorthand: 'f' },
    offline: { type: Boolean, shorthand: 'o' },
    verbose: { type: Boolean, shorthand: 'V'},
    quiet: { type: Boolean, shorthand: 'q' },
    loglevel: { type: String, shorthand: 'l' },
    json: { type: Boolean, shorthand: 'j' },
    silent: { type: Boolean, shorthand: 's' }
}));

// TODO: some config's are not being used thorough the architecture components

module.exports = config;
