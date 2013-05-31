var Emitter = require('events').EventEmitter;
var cli = require('../util/cli');

function help(name) {
    var emitter = new Emitter();
    var json;

    if (!name) {
        json = require('../../templates/json/help.json');
    } else {
        json = require('../../templates/json/help-' + name + '.json');
    }

    process.nextTick(function () {
        emitter.emit('end', json);
    });

    emitter.name = 'help';

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
