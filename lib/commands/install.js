var EventEmitter = require('events').EventEmitter;
var mout = require('mout');
var Project = require('../core/Project');
var Logger = require('../core/Logger');
var cli = require('../util/cli');
var defaultConfig = require('../config');

function install(endpoints, options, config) {
    var project;
    var emitter = new EventEmitter();
    var logger = new Logger();

    options = options || {};
    config = mout.object.deepFillIn(config || {}, defaultConfig);
    project = new Project(config, logger);

    // If endpoints is an empty array, null them
    if (endpoints && !endpoints.length) {
        endpoints = null;
    }

    project.install(endpoints, options)
    .then(function (installed) {
        emitter.emit('end', installed);
    })
    .fail(function (error) {
        emitter.emit('error', error);
    });

    return logger.pipe(emitter);
}

// -------------------

install.line = function (argv) {
    var options = install.options(argv);
    return install(options.argv.remain.slice(1), options);
};

install.options = function (argv) {
    return cli.readOptions({
        'production': { type: Boolean, shorthand: 'p' },
        'save': { type: Boolean, shorthand: 'S' },
        'save-dev': { type: Boolean, shorthand: 'D' }
    }, argv);
};

install.completion = function () {
    // TODO:
};

module.exports = install;
