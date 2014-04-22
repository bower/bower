var fs = require('graceful-fs');
var path = require('path');

function findRoot(cwd) {
    var root = null;

    if (!cwd) {
        // If no path is passed in, default to CWD
        cwd = process.cwd();
    }

    var current = cwd;

    while (current !== '/') {
        if (fs.existsSync(path.join(current, 'bower.json')) && !fs.existsSync(path.join(current, '.bower.json'))) {
            root = current;
        }
        current = path.dirname(current);
    }

    if (root === null) {
        root = cwd;
    }

    return root;
}

module.exports = findRoot;
