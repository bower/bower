var EventEmitter = require('events').EventEmitter;
var cli = require('../util/cli');

function help(name) {
    var json;
    var emitter = new EventEmitter();

    if (!name) {
        json = require('../../templates/json/help.json');
    } else {
        json = require('../../templates/json/help-' + name + '.json');
    }

    process.nextTick(function () {
        emitter.emit('end', json);
    });

    emitter.command = 'help';

    return emitter;
}

// -------------------

help.line = function (argv) {
    var options = help.options(argv);

    return help(options.argv.remain[1]);
};

help.options = function (argv) {
    return cli.readOptions(argv);
};

help.completion = function () {
    // TODO
};

module.exports = help;
