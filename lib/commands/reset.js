var Project = require('../core/Project');
var cli = require('../util/cli');
var defaultConfig = require('../config');

function reset(logger, names, options, config) {
    var project;

    options = options || {};
    config = defaultConfig(config);
    project = new Project(config, logger);

    // If names is an empty array, null them
    if (names && !names.length) {
        names = null;
    }

    return true
}

// -------------------

reset.line = function (logger, argv) {
console.log("Running")
};

reset.options = function (argv) {
    return cli.readOptions({
        'force-latest': { type: Boolean, shorthand: 'F' },
        'production': { type: Boolean, shorthand: 'p' }
    }, argv);
};

reset.completion = function () {
    // TODO:
};

module.exports = reset;
