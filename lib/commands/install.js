var endpointParser = require('bower-endpoint-parser');
var Project = require('../core/Project');
var defaultConfig = require('../config');

function install(logger, endpoints, options, config) {
    var project;
    var decEndpoints;

    options = options || {};
    config = defaultConfig(config);
    if (options.save === undefined) {
        options.save = config.defaultSave;
    }
    project = new Project(config, logger);

    // Convert endpoints to decomposed endpoints
    endpoints = endpoints || [];
    decEndpoints = endpoints.map(function (endpoint) {
        // handle @ as version divider
        endpoint = endpoint.replace('@', '#');
        return endpointParser.decompose(endpoint);
    });

    return project.install(decEndpoints, options, config);
}

// -------------------

install.readOptions = function (argv) {
    var cli = require('../util/cli');

    var options = cli.readOptions({
        'force-latest': { type: Boolean, shorthand: 'F'},
        'production': { type: Boolean, shorthand: 'p' },
        'save': { type: Boolean, shorthand: 'S' },
        'save-dev': { type: Boolean, shorthand: 'D' },
        'save-exact': { type: Boolean, shorthand: 'E' }
    }, argv);

    var packages = options.argv.remain.slice(1);

    delete options.argv;

    return [packages, options];
};

module.exports = install;
