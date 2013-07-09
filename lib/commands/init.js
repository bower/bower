var EventEmitter = require('events').EventEmitter;
var cli = require('../util/cli');
var createError = require('../util/createError');

function init() {
    var emitter = new EventEmitter();

    process.nextTick(function () {
        emitter.emit('error', createError('Command not yet implemented.', 'ENOTIMPL'));
    });

    return emitter;
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
