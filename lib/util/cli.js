var mout = require('mout');
var nopt = require('nopt');
var renderers = require('../renderers');
var createError = require('./createError');

var READ_OPTIONS_ERROR_CODE = 'EREADOPTIONS';

function readOptions(options, argv) {
    var types;
    var noptOptions;
    var parsedOptions = {};
    var shorthands = {};

    if (Array.isArray(options)) {
        argv = options;
        options = {};
    } else {
        options = options || {};
    }

    types = mout.object.map(options, function (option) {
        return option.type;
    });
    mout.object.forOwn(options, function (option, name) {
        shorthands[option.shorthand] = '--' + name;
    });

    noptOptions = nopt(types, shorthands, argv);

    // Filter only the specified options because nopt parses every --
    // Also make them camel case
    mout.object.forOwn(noptOptions, function (value, key) {
        if (options[key]) {
            parsedOptions[mout.string.camelCase(key)] = value;
        }
    });

    parsedOptions.argv = noptOptions.argv;

    return parsedOptions;
}

/**
 * Creates an error for the case where a command has trouble parsing command
 * line options.
 **/
function createReadOptionsError(commandName) {
    var errorString = commandName + ' syntax error';

    return createError(errorString, READ_OPTIONS_ERROR_CODE);
}

function getRenderer(command, json, config) {
    if (config.json || json) {
        return new renderers.Json(command, config);
    }

    return new renderers.Standard(command, config);
}

module.exports.readOptions = readOptions;
module.exports.getRenderer = getRenderer;

module.exports.createReadOptionsError = createReadOptionsError;
module.exports.READ_OPTIONS_ERROR_CODE = READ_OPTIONS_ERROR_CODE;
