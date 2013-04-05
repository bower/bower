var UrlPackage = require('../lib/core/packages/UrlPackage');
var GitRemotePackage = require('../lib/core/packages/GitRemotePackage');

function testUrlPackage() {
    var bootstrapPackage = new UrlPackage('http://twitter.github.com/bootstrap/assets/bootstrap.zip', { name: 'bootstrap' });

    return bootstrapPackage.resolve()
    .then(function () {
        console.log('ok!');
    }, function (err) {
        console.log('failed to resolve', err);
    });
}

function testGitRemotePackage() {
    var dejavuPackage = new GitRemotePackage('git://github.com/IndigoUnited/dejavu.git', { name: 'bootstrap' });

    return dejavuPackage.resolve()
    .then(function () {
        console.log('ok!');
    }, function (err) {
        console.log('failed to resolve', err);
    });
}

if (process.argv[1] && !/mocha/.test(process.argv[1])) {
    testUrlPackage()
    .then(testGitRemotePackage);
}