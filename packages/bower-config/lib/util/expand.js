var object = require('mout/object');
var lang = require('mout/lang');
var string = require('mout/string');

function camelCase(config) {
    var camelCased = {};

    // Camel case
    object.forOwn(config, function (value, key) {
        // Ignore null values
        if (value == null) {
            return;
        }

        key = string.camelCase(key.replace(/_/g, '-'));
        camelCased[key] = lang.isPlainObject(value) ? camelCase(value) : value;
    });

    return camelCased;
}

// Function to replace ${VAR} - style variables
//  with values set in the environment
// This function expects to be passed a string
function doEnvReplaceStr (f) {

  // Un-tildify
  var untildify = require('untildify');
  f = untildify(f);

  // replace any ${ENV} values with the appropriate environ.
  var envExpr = /(\\*)\$\{([^}]+)\}/g;
  return f.replace(envExpr, function (orig, esc, name) {
    esc = esc.length && esc.length % 2;
    if (esc) return orig;
    if (undefined === process.env[name]) {
      throw new Error('Environment variable used in .bowerrc is not defined: ' + orig);
    }

    return process.env[name];
});
}

function envReplace(config) {
    var envReplaced = {};

    object.forOwn(config, function (value, key) {
        // Ignore null values
        if (value == null) {
            return;
        }

        // Perform variable replacements based on var type
        if ( lang.isPlainObject(value) ) {
            envReplaced[key] = envReplace(value);
        }
        else if ( lang.isString(value) ) {
            envReplaced[key] = doEnvReplaceStr(value);
        }
        else {
            envReplaced[key] = value;
        }
    });

    return envReplaced;
}

function expand(config) {
    config = camelCase(config);
    config = envReplace(config);

    if (typeof config.registry === 'string') {
        config.registry = {
            default: config.registry,
            search: [config.registry],
            register: config.registry,
            publish: config.registry
        };
    } else if (typeof config.registry === 'object') {
        config.registry.default = config.registry.default || 'https://bower.herokuapp.com';

        config.registry = {
            default: config.registry.default,
            search: config.registry.search || config.registry.default,
            register: config.registry.register || config.registry.default,
            publish: config.registry.publish || config.registry.default
        };

        if (config.registry.search && !Array.isArray(config.registry.search)) {
            config.registry.search = [config.registry.search];
        }
    }

    // CA
    if (typeof config.ca === 'string') {
        config.ca = {
            default: config.ca,
            search: [config.ca],
            register: config.ca,
            publish: config.ca
        };
    } else if (typeof config.ca === 'object') {
        if (config.ca.search && !Array.isArray(config.ca.search)) {
            config.ca.search = [config.ca.search];
        }

        if (config.ca.default) {
            config.ca.search = config.ca.search || config.ca.default;
            config.ca.register = config.ca.register || config.ca.default;
            config.ca.publish = config.ca.publish || config.ca.default;
        }
    }

    return config;
}

module.exports = expand;
