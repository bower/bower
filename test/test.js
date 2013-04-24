var GitRemoteResolver = require('../lib/resolve/resolvers/GitRemoteResolver');
var GitFsResolver = require('../lib/resolve/resolvers/GitFsResolver');

function testGitRemoteResolver() {
    var dejavuResolver = new GitRemoteResolver('git://github.com/IndigoUnited/dejavu.git', {
        name: 'dejavu',
        //target: '7d07190ca6fb7ffa63642526537e0c314cbaab12'
        //target: 'master'
        target: '~0.4.1'
    });

    return dejavuResolver.resolve()
    .then(function () {
        console.log('ok!');
    });
}

function testGitFsResolver() {
    var bowerResolver = new GitFsResolver(__dirname + '/..', {
        name: 'bower',
        target: 'rewrite'
    });

    return bowerResolver.resolve()
    .then(function () {
        console.log('ok!');
    });
}

function testGitRemoteResolverNoTags() {
    var spoonResolver = new GitRemoteResolver('git://github.com/IndigoUnited/spoon.js.git', {
        name: 'spoonjs',
        //target: '7d07190ca6fb7ffa63642526537e0c314cbaab12'
        //target: 'master'
        target: '*'
    });

    return spoonResolver.resolve()
    .then(function () {
        console.log('ok!');
    });
}

if (process.argv[1] && !/mocha/.test(process.argv[1])) {
    testGitRemoteResolver()
    .then(testGitFsResolver)
    .then(testGitRemoteResolverNoTags);

    //testGitFsResolver();
    //testGitRemoteResolverNoTags();
} else {

    // Cleanup the uncaughtException added by the tmp module
    // It messes with the mocha uncaughtException event to caught errors
    process.removeAllListeners('uncaughtException');

    require('./resolve/resolver');
    require('./resolve/resolvers/gitResolver');
    require('./resolve/resolvers/gitFsResolver');
    require('./resolve/resolvers/gitRemoteResolver');
    require('./resolve/worker');
    require('./resolve/resolverFactory');
}