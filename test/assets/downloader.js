var fs = require('fs');
var path = require('path');
var cmd = require('../../lib/util/cmd');
var fetchBranch = require('../util/fetchBranch');

var githubTestPackage = path.join(__dirname, 'github-test-package');

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
    .then(function () {
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

