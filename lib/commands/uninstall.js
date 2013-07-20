var mout = require('mout');
var Logger = require('bower-logger');
var Project = require('../core/Project');
var cli = require('../util/cli');
var defaultConfig = require('../config');

function uninstall(names, options, config) {
    var project;
    var logger = new Logger();

    options = options || {};
    config = mout.object.deepFillIn(config || {}, defaultConfig);
    project = new Project(config, logger);

    // If names is an empty array, null them
    if (names && !names.length) {
        names = null;
    }

    project.uninstall(names, options)
    .then(function (removed) {
        logger.emit('end', removed);
    })
    .fail(function (error) {
        logger.emit('error', error);
    });

    return logger;
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
