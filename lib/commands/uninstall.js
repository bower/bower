var EventEmitter = require('events').EventEmitter;
var mout = require('mout');
var Project = require('../core/Project');
var Logger = require('../core/Logger');
var cli = require('../util/cli');
var defaultConfig = require('../config');

function uninstall(names, options, config) {
    var project;
    var emitter = new EventEmitter();
    var logger = new Logger();

    options = options || {};
    config = mout.object.deepFillIn(config || {}, defaultConfig);
    project = new Project(config, logger);

    // If names is an empty array, null them
    if (names && !names.length) {
        names = null;
    }

    emitter = new EventEmitter();

    project.uninstall(names, options)
    .then(function (removed) {
        emitter.emit('end', removed);
    })
    .fail(function (error) {
        emitter.emit('error', error);
    });

    return logger.pipe(emitter);
}

// -------------------

uninstall.line = function (argv) {
    var options = uninstall.options(argv);
    var names = options.argv.remain.slice(1);

    if (!names.length) {
        return null;
    }

    return uninstall(names, options);
};

uninstall.options = function (argv) {
    return cli.readOptions({
        'save': { type: Boolean, shorthand: 'S' },
        'save-dev': { type: Boolean, shorthand: 'D' }
    }, argv);
};

uninstall.completion = function () {
    // TODO:
};

module.exports = uninstall;
