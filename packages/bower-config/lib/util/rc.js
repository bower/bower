var path = require('path');
var optimist = require('optimist');
var osenv = require('osenv');
var mout = require('mout');
var cc = require('rc/lib/utils');

var win = process.platform === 'win32';
var home = osenv.home();

function rc(name, defaults, cwd, argv) {
    defaults = defaults || {};
    cwd = cwd || process.cwd();
    argv = argv || optimist.argv;

    return mout.object.deepMixIn.apply(null, [
        defaults,
        win ? {} : cc.json(path.join('/etc', name, 'config')),
        win ? {} : cc.json(path.join('/etc', name + 'rc')),
        cc.json(path.join(home, '.config', name, 'config')),
        cc.json(path.join(home, '.config', name)),
        cc.json(path.join(home, '.' + name, 'config')),
        cc.json(path.join(home, '.' + name + 'rc')),
        cc.json(path.join(cwd, '.' + name + 'rc')),
        cc.env(name + '_'),
        typeof argv.config !== 'object' ? {} : argv.config
    ]);
}

module.exports = rc;
