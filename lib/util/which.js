var join = require('path').join;
var execFileSync = require('child_process').execFileSync;
var cache = {};
var originalWhich = require('which');

var isWin = process.platform === 'win32';

function which(name, opt, cb) {
    if (typeof opt === 'function') {
        cb = opt;
        opt = {};
    }

    if (isWin) {
        var result = whichSync(name);
        if (result) {
            cb(null, result);
        } else {
            cb(new Error('Could not find ' + name + ' in PATH'));
        }
    } else {
        originalWhich(name, opt, cb);
    }
}

function whichSync(name, opt) {
    if (name in cache) {
        return cache[name];
    }
    if (isWin) {
        var WHERE_PATH = join(process.env.WINDIR, 'System32', 'where.exe');
        var stdout = execFileSync(WHERE_PATH, ['$PATH:' + name], {
            stdio: ['pipe', 'pipe', 'ignore']
        }).toString();
        var matches = stdout.split('\r\n');
        if (matches.length === 0) {
            throw new Error('Could not find ' + name + ' in PATH');
        }
        var result = matches[0].trim();
        cache[name] = result;
        return result;
    }

    var result = originalWhich.sync(name, opt);
    cache[name] = result;
    return result;
}

which.sync = whichSync;

module.exports = which;
