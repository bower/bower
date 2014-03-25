var mout = require('mout');
var Logger = require('bower-logger');
var Project = require('../core/Project');
var cli = require('../util/cli');
var defaultConfig = require('../config');

function prune(options, config) {
    var project;
    var logger = new Logger();

    options = options || {};
    config = mout.object.deepFillIn(config || {}, defaultConfig);
    project = new Project(config, logger);

    clean(project, options)
    .done(function (removed) {
        logger.emit('end', removed);
    }, function (error) {
        logger.emit('error', error);
    });

    return logger;
}

function clean(project, options, removed) {
    removed = removed || {};

    // Continually call clean until there is no more extraneous
    // dependencies to remove
    return project.getTree(options)
    .spread(function (tree, flattened, extraneous) {
        var names = extraneous.map(function (extra) {
            return extra.endpoint.name;
        });

        // Uninstall extraneous
        return project.uninstall(names, options)
        .then(function (uninstalled) {
            // Are we done?
            if (!mout.object.size(uninstalled)) {
                return removed;
            }

            // Not yet, recurse!
            mout.object.mixIn(removed, uninstalled);
            return clean(project, options, removed);
        });
    });
}

// -------------------

prune.line = function (argv) {
    var options = prune.options(argv);
    return prune(options);
};

prune.options = function (argv) {
    return cli.readOptions({
        'production': { type: Boolean, shorthand: 'p' },
    }, argv);
};

prune.completion = function () {
    // TODO:
};

module.exports = prune;
