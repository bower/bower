var Project = require('../core/Project');
var defaultConfig = require('../config');

function shrinkwrap(logger, names, options, config) {
    var project;

    options = options || {};
    config = defaultConfig(config);
    project = new Project(config, logger);

    // If names is an empty array, null them
    if (names && !names.length) {
        names = null;
    }

    return true;
}

// -------------------

shrinkwrap.line = function (logger, argv) {
    return shrinkwrap(logger);
};

shrinkwrap.options = function (argv) {
    // TODO:
};

shrinkwrap.completion = function () {
    // TODO:
};

module.exports = shrinkwrap;
