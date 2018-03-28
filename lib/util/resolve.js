var requireg = require('requireg');
var resolve = require('resolve');

function startsWith(string, searchString, position) {
    position = position || 0;
    return string.substr(position, searchString.length) === searchString;
}

module.exports = function(id, options) {
    var resolvedPath;

    var cwd = (options || {}).cwd || process.cwd();

    try {
        resolvedPath = resolve.sync(id, { basedir: cwd });
    } catch (e) {
        // Fallback to global require
        resolvedPath = requireg.resolve(id);
    }

    return resolvedPath;
};
