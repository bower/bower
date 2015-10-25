var Project = require('../core/Project');
var defaultConfig = require('../config');

function update(logger, names, options, config) {
    var project;

    options = options || {};
    config = defaultConfig(config);
    if(options.disableHooks === undefined) {
        options.disableHooks = !!config.defaultDisableHooks;
    }
    project = new Project(config, logger, options);

    // If names is an empty array, null them
    if (names && !names.length) {
        names = null;
    }

    return project.update(names, options);
}

// -------------------

update.readOptions = function (argv) {
    var cli = require('../util/cli');

    var options = cli.readOptions({
        'force-latest': { type: Boolean, shorthand: 'F' },
        'production': { type: Boolean, shorthand: 'p' },
        'disable-hooks': { type: Boolean, shorthand: 'H' }
    }, argv);

    var names = options.argv.remain.slice(1);

    delete options.argv;

    return [names, options];
};

module.exports = update;
