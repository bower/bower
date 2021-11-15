var childProcess = require('child_process');
var which = require('./which');

function execFile(cmd, args, opt, cb) {
    cmd = which(cmd);
    childProcess.execFile(cmd, args, opt, cb);
}

function spawn(cmd, args, opt) {
    cmd = which(cmd);
    childProcess.spawn(cmd, args, opt);
}

module.exports = {
    execFile: execFile,
    spawn: spawn
};
