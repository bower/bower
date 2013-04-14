var GitResolver = require('../lib/resolve/resolvers/GitRemoteResolver');

function testGitResolver() {
    var dejavuResolver = new GitResolver('git://github.com/IndigoUnited/dejavu.git', {
        name: 'dejavu',
        //target: '962be0f7b779b061eccce6a661928cb719031964'
        //target: 'master'
        target: '~0.4.1'
    });

    return dejavuResolver.resolve()
    .then(function () {
        console.log('ok!');
    }, function (err) {
        console.log('failed to resolve', err);
    });
}

if (process.argv[1] && !/mocha/.test(process.argv[1])) {
    testGitResolver();
}