var EventEmitter = require('events').EventEmitter;
var mout = require('mout');
var Project = require('../core/Project');
var Logger = require('../core/Logger');
var cli = require('../util/cli');
var help = require('./help');
var defaultConfig = require('../config');

function uninstall(names, options, config) {
    var project;
    var emitter = new EventEmitter();
    var logger = new Logger();

    options = options || {};
    config = mout.object.deepMixIn(config, defaultConfig);

    // If names is an empty array, null them
    if (names && !names.length) {
        names = null;
    }

    emitter = new EventEmitter();
    emitter.command = 'uninstall';

    project = new Project(config, logger);
    project.uninstall(names, options)
    .then(function (installed) {
        emitter.emit('end', installed);
    }, function (error) {
        emitter.emit('error', error);
    });

    return logger.pipe(emitter);
}

// -------------------

uninstall.line = function (argv) {
    var options = uninstall.options(argv);
    var names = options.argv.remain.slice(1);

    if (options.help || !names.length) {
        return help('uninstall');
    }

    return uninstall(names, options);
};

uninstall.options = function (argv) {
    return cli.readOptions({
        'help': { type: Boolean, shorthand: 'h' },
        'save': { type: Boolean, shorthand: 'S' },
        'save-dev': { type: Boolean, shorthand: 'D' }
    }, argv);
};

uninstall.completion = function () {
    // TODO:
};

module.exports = uninstall;
