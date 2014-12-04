var Project = require('../core/Project');
var defaultConfig = require('../config');

function reset(logger, names, options, config) {
    var project;

    config = defaultConfig(config);
    project = new Project(config, logger);

    return project.reset();
}

// -------------------

reset.line = function (logger, argv) {
    return reset(logger, argv);
};

module.exports = reset;
