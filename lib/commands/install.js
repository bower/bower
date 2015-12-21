var endpointParser = require('bower-endpoint-parser');
var Project = require('../core/Project');
var Tracker = require('../util/analytics').Tracker;
var defaultConfig = require('../config');
var hasGit = require('../util/git')();
var createError = require('../util/createError');

function install(logger, endpoints, options, config) {
    if (!hasGit) {
        throw createError('Git is not installed or not in the right PATH', 'ENOGIT');
    }
    var project;
    var decEndpoints;
    var tracker;

    options = options || {};
    config = defaultConfig(config);
    if (options.save === undefined) {
        options.save = config.defaultSave;
    }
    project = new Project(config, logger);
    tracker = new Tracker(config);

    // Convert endpoints to decomposed endpoints
    endpoints = endpoints || [];
    decEndpoints = endpoints.map(function (endpoint) {
        return endpointParser.decompose(endpoint);
    });
    tracker.trackDecomposedEndpoints('install', decEndpoints);

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
