var cmd = require('../../lib/util/cmd');

function fetchBranch(branch, dir) {
    return cmd('git', ['checkout', '-b', branch, 'origin/' + branch], { cwd: dir })
    .then(null, function (err) {
        if (/already exists/i.test(err.details)) {
            return cmd('git', ['checkout', branch], { cwd: dir })
            .then(function () {
                return cmd('git', ['pull', 'origin', branch], { cwd: dir });
            });
        }
    });
}

module.exports = fetchBranch;