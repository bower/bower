var Logger = require('bower-logger');
var cli = require('../util/cli');
var createError = require('../util/createError');

function init() {
    var logger = new Logger();

    process.nextTick(function () {
        logger.emit('error', createError('Command not yet implemented.', 'ENOTIMPL'));
    });

    return logger;
}

// -------------------

init.line = function () {
    return init();
};

init.options = function (argv) {
    return cli.readOptions(argv);
};

init.completion = function () {
    // TODO:
};

module.exports = init;
