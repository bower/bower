var Emitter = require('events').EventEmitter;
var mout = require('mout');
var Project = require('../core/Project');
var cli = require('../util/cli');
var help = require('./help');
var defaultConfig = require('../config');

function install(endpoints, options, config) {
    var project;
    var emitter = new Emitter();

    options = options || {};
    config = mout.object.deepMixIn(config, defaultConfig);

    // If endpoints are an empty array, null them
    if (endpoints && !endpoints.length) {
        endpoints = null;
    }

    project = new Project(config);
    project.install(endpoints, options)
    .then(function (installed) {
        emitter.emit('end', installed);
    }, function (error) {
        emitter.emit('error', error);
    }, function (notification) {
        emitter.emit('notification', notification);
    });

    emitter.command = 'install';

    return emitter;
}

// -------------------

install.line = function (argv) {
    var options = install.options(argv);

    if (options.help) {
        return help('install');
    }

    return install(options.argv.remain.slice(1), options);
};

install.options = function (argv) {
    return cli.readOptions({
        'help': { type: Boolean, shorthand: 'h' },
        'save': { type: Boolean, shorthand: 'S' },
        'save-dev': { type: Boolean, shorthand: 'D' },
        'production': { type: Boolean, shorthand: 'p' },
        'force-latest': { type: Boolean, shorthand: 'F'}
    }, argv);
};

install.completion = function () {
    // TODO:
};

module.exports = install;
