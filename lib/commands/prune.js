var EventEmitter = require('events').EventEmitter;
var mout = require('mout');
var Project = require('../core/Project');
var Logger = require('../core/Logger');
var cli = require('../util/cli');
var defaultConfig = require('../config');

function prune(names, config) {
    var project;
    var emitter = new EventEmitter();
    var logger = new Logger();

    config = mout.object.deepFillIn(config || {}, defaultConfig);
    project = new Project(config, logger);

    // If names is an empty array, null them
    if (names && !names.length) {
        names = null;
    }

    emitter = new EventEmitter();

    // Figure out extraneous
    project.getTree()
    .spread(function (tree, flattened, extraneous) {
        var names;

        names = extraneous.map(function (extra) {
            return extra.endpoint.name;
        });

        // Uninstall them
        project.uninstall(names)
        .then(function (removed) {
            emitter.emit('end', removed);
        })
        .fail(function (error) {
            emitter.emit('error', error);
        });
    });

    return logger.pipe(emitter);
}

// -------------------

prune.line = function () {
    return prune();
};

prune.options = function (argv) {
    return cli.readOptions(argv);
};

prune.completion = function () {
    // TODO:
};

module.exports = prune;
