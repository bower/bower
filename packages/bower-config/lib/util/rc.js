var path = require('path');
var fs = require('graceful-fs');
var yargs = require('yargs');
var osenv = require('osenv');
var object = require('mout/object');
var string = require('mout/string');
var paths = require('./paths');
var defaults = require('./defaults');

var win = process.platform === 'win32';
var home = osenv.home();

function rc(name, cwd, argv) {
    var argvConfig;

    argv = argv || yargs.argv;

    // Parse --config.foo=false
    argvConfig = object.map(argv.config || {}, function(value) {
        return value === 'false' ? false : value;
    });

    // If we have specified a cwd then use this as the base for getting config.
    cwd = argvConfig.cwd ? argvConfig.cwd : cwd;

    if (cwd) {
        return object.deepMixIn.apply(null, [
            {},
            defaults,
            { cwd: cwd },
            win ? {} : json(path.join('/etc', name + 'rc')),
            !home ? {} : json(path.join(home, '.' + name + 'rc')),
            json(path.join(paths.config, name + 'rc')),
            json(find('.' + name + 'rc', cwd)),
            env('npm_package_config_' + name + '_'),
            env(name + '_'),
            argvConfig
        ]);
    } else {
        return object.deepMixIn.apply(null, [
            {},
            defaults,
            win ? {} : json(path.join('/etc', name + 'rc')),
            !home ? {} : json(path.join(home, '.' + name + 'rc')),
            json(path.join(paths.config, name + 'rc')),
            env('npm_package_config_' + name + '_'),
            env(name + '_'),
            argvConfig
        ]);
    }
}

function parse(content, file) {
    var error;

    if (!content.trim().length) {
        return {};
    }

    try {
        return JSON.parse(content);
    } catch (e) {
        if (file) {
            error = new Error('Unable to parse ' + file + ': ' + e.message);
        } else {
            error = new Error('Unable to parse rc config: ' + e.message);
        }

        error.details = content;
        error.code = 'EMALFORMED';
        throw error;
    }
}

function json(file) {
    var content = {};
    if (!Array.isArray(file)) {
        try {
            content = fs.readFileSync(file).toString();
        } catch (err) {
            return null;
        }

        return parse(content, file);
    } else {
        // This is multiple json files
        file.forEach(function(filename) {
            if (fs.statSync(filename).isDirectory()) {
                var error;
                error = new Error(filename + ' should not be a directory');
                error.code = 'EFILEISDIR';
                throw error;
            }
            var json = fs.readFileSync(filename).toString();
            json = parse(json, filename);
            content = object.merge(content, json);
        });

        return content;
    }
}

function env(prefix) {
    var obj = {};
    var prefixLength = prefix.length;

    prefix = prefix.toLowerCase();

    object.forOwn(process.env, function(value, key) {
        key = key.toLowerCase();

        if (string.startsWith(key, prefix)) {
            var parsedKey = key
                .substr(prefixLength)
                .replace(/__/g, '.') // __ is used for nesting
                .replace(/_/g, '-'); // _ is used as a - separator

            //use a convention patern to accept array from process.env
            //e.g. export bower_registry__search='["http://abc.com","http://def.com"]'
            var match = /\[([^\]]*)\]/g.exec(value);
            var targetValue;
            if (!match || match.length === 0) {
                targetValue = value;
            } else {
                targetValue = match[1].split(',').map(function(m) {
                    return m.trim();
                });
            }
            object.set(obj, parsedKey, targetValue);
        }
    });

    return obj;
}

function find(filename, dir) {
    var files = [];

    var walk = function(filename, dir) {
        var file = path.join(dir, filename);
        var parent = path.dirname(dir);

        if (fs.existsSync(file)) {
            files.push(file);
        }

        if (parent !== dir) {
            walk(filename, parent);
        }
    };

    walk(filename, dir);
    files.reverse();
    return files;
}

module.exports = rc;
