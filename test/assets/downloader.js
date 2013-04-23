var fs = require('fs');
var path = require('path');
var cmd = require('../../lib/util/cmd');

var githubTestPackage = path.join(__dirname, 'github-test-package');

if (!fs.existsSync(githubTestPackage)) {
    console.log('Cloning "test-package"');

    cmd('git', ['clone', 'git://github.com/bower/test-package.git', githubTestPackage])
    .then(function () {
        console.log('Successfully downloaded "test-package"');
    })
    .done();
} else {
    console.log('Updating "test-package"');

    cmd('git', ['fetch', '--prune'], { cwd: githubTestPackage })
    .then(function () {
        console.log('Successfully updated "test-package"');
    });
}