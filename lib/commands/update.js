var Emitter = require('events').EventEmitter;
var mout = require('mout');
var Project = require('../core/Project');
var cli = require('../util/cli');
var help = require('./help');
var defaultConfig = require('../config');

function update(endpoints, options, config) {
    var project;
    var emitter = new Emitter();

    options = options || {};
    config = mout.object.deepMixIn(config, defaultConfig);

    // If endpoints are an empty array, null them
    if (endpoints && !endpoints.length) {
        endpoints = null;
    }

    project = new Project(config);
    project.update(endpoints, options)
    .then(function (installed) {
        emitter.emit('end', installed);
    }, function (error) {
        emitter.emit('error', error);
    }, function (notification) {
        emitter.emit('notification', notification);
    });

    emitter.name = 'update';

    return emitter;
}

// -------------------

update.line = function (argv) {
    var options = update.options(argv);

    if (options.help) {
        return help('update');
    }

    return update(options.argv.remain.slice(1), options);
};

update.options = function (argv) {
    return cli.readOptions({
        'help': { type: Boolean, shorthand: 'h' },
        'production': { type: Boolean, shorthand: 'p' }
    }, argv);
};

update.completion = function () {
    // TODO:
};

module.exports = update;
