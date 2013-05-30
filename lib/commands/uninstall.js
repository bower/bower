var Emitter = require('events').EventEmitter;
var mout = require('mout');
var Project = require('../core/Project');
var cli = require('../util/cli');
var help = require('./help');
var defaultConfig = require('../config');

function uninstall(endpoints, options, config) {
    var project;
    var emitter = new Emitter();

    options = options || {};
    config = mout.object.deepMixIn(config, defaultConfig);

    // If endpoints are an empty array, null them
    if (endpoints && !endpoints.length) {
        endpoints = null;
    }

    project = new Project(config);
    project.uninstall(endpoints, options)
    .then(function (uninstalled) {
        emitter.emit('end', uninstalled);
    }, function (error) {
        emitter.emit('error', error);
    }, function (notification) {
        emitter.emit('notification', notification);
    });

    return emitter;
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
