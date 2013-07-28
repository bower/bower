/*jshint multistr:true*/

var sudoBlock = require('sudo-block');
var createError = require('./createError');
var cli = require('./cli');

var renderer;

function rootCheck(options, command, config) {
    if (options.allowRoot) {
    // Allow running the command as root
        return;
    }

    var errorMsg = 'Since bower is a user command, there is no need to execute it with superuser \
permissions.\nIf you\'re having permission errors when using bower without sudo, \
please spend a few minutes learning more about how your system should work\
and make any necessary repairs.\n\
http://www.joyent.com/blog/installing-node-and-npm\n\
https://gist.github.com/isaacs/579814\n\
You can however run a command with sudo using --allow-root option';

    if (sudoBlock.isRoot) {
        renderer = cli.getRenderer(command, false, config);
        renderer.error(createError('Cannot be run with sudo', 'ESUDO', { details : errorMsg }));
        process.exit(1);
    }
}

module.exports = rootCheck;
