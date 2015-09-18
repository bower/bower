var Project = require('../core/Project');
var defaultConfig = require('../config');

function reset(logger, names, options, config) {
    var project;

    config = defaultConfig(config);
    project = new Project(config, logger);

    return project.reset();
}

reset.readOptions = function (argv) {
    var cli = require('../util/cli');

    var options = cli.readOptions(argv);
    var name = options.argv.remain[1];
    var url = options.argv.remain[2];

    return [name, url];
};

reset.line = function (logger, argv) {
    return reset(logger, argv);
};

module.exports = reset;
