var fs = require('graceful-fs');
var path = require('path');
var cmd = require('../../lib/util/cmd');

var githubTestPackage = path.join(__dirname, 'github-test-package');

function fetchBranch(branch, dir) {
    return cmd('git', ['checkout', '-b', branch, 'origin/' + branch], { cwd: dir })
    .fail(function (err) {
        if (/already exists/i.test(err.details)) {
            return cmd('git', ['checkout', branch], { cwd: dir })
            .then(function () {
                return cmd('git', ['pull', 'origin', branch], { cwd: dir });
            });
        }
    });
}

function updateBranches() {
    console.log('Updating "test-package" branches..');

    return fetchBranch('master', githubTestPackage)
    .then(function () {
        return fetchBranch('some-branch', githubTestPackage);
    })
    .then(function () {
        console.log('Successfully updated "test-package" branches\n');
    });
}

if (!fs.existsSync(githubTestPackage)) {
    console.log('Cloning "test-package"..');

    cmd('git', ['clone', 'git://github.com/bower/test-package.git', githubTestPackage])
    .then(function () {
        console.log('Successfully downloaded "test-package"');
        return updateBranches();
    })
    .done();
} else {
    console.log('Fetching "test-package"..');

    cmd('git', ['fetch', '--prune'], { cwd: githubTestPackage })
    .then(function () {
        console.log('Successfully fetched "test-package"');
        return updateBranches();
    })
    .done();
}

