var childProcess = require('child_process');
var which = require('./which');

function execFile(cmd, args, opt, cb) {
    try {
        cmd = which.sync(cmd);
    } catch (e) {
        cb(e);
    }
    return childProcess.execFile(cmd, args, opt, cb);
}

function spawn(cmd, args, opt) {
    cmd = which.sync(cmd);
    return childProcess.spawn(cmd, args, opt);
}

module.exports = {
    execFile: execFile,
    spawn: spawn
};
