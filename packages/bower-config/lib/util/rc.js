var path = require('path');
var fs = require('graceful-fs');
var optimist = require('optimist');
var osenv = require('osenv');
var mout = require('mout');
var rimraf = require('rimraf');
var paths = require('./paths');

var win = process.platform === 'win32';
var home = osenv.home();

function rc(name, defaults, cwd, argv) {
    defaults = defaults || {};
    cwd = cwd || process.cwd();
    argv = argv || optimist.argv;

    return mout.object.deepMixIn.apply(null, [
        defaults,
        win ? {} : json(path.join('/etc', name + 'rc')),
        json(path.join(home, '.' + name + 'rc')),
        json(path.join(paths.config, name + 'rc')),
        json(find('.' + name + 'rc', cwd)),
        env(name + '_'),
        typeof argv.config !== 'object' ? {} : argv.config
    ]);
}

function parse(content, file) {
    try {
        return JSON.parse(content);
    } catch (e) {
        // If we got an error, remove the file
        if (file) {
            try {
                rimraf.sync(file);
            } catch (e) {}
        }
    }

    return null;
}

function json(file) {
    var content;

    try {
        content = fs.readFileSync(file);
    } catch (err) {
        return null;
    }

    return parse(content, file);
}

function env(prefix) {
    var obj = {};
    var prefixLength = prefix.length;

    mout.object.forOwn(process.env, function (value, key) {
        if (mout.string.startsWith(key, prefix)) {
            obj[key.substr(prefixLength)] = value;
        }
    });

    return obj;
}

function find(filename, dir) {
    var walk = function (filename, dir) {
        var file = path.join(dir, filename);
        var parent = path.dirname(dir);

        try {
            fs.statSync(file);
            return file;
        } catch (err) {
            // Check if we hit the root
            if (parent === dir) {
                return null;
            }

            return walk(filename, parent);
        }
    };

    dir = dir || process.cwd();
    return walk(filename, dir);
}

module.exports = rc;
