var tmp = require('tmp');
var fs = require('fs');
var path = require('path');

var childProcess = require('child_process');
var arraydiff = require('arr-diff');
var wrench = require('wrench');

var jsonPackage = require('./package');

if (
    childProcess
        .execSync('git rev-parse --abbrev-ref HEAD')
        .toString()
        .trim() !== 'master'
) {
    console.log('You need to release bower from the "master" branch');

    process.exit(1);
}

var dir = tmp.dirSync().name;


console.log('\nInstalling production bundle in:');
console.log(dir + '\n');

wrench.copyDirSyncRecursive(__dirname, dir, {
    forceDelete: true,
    include: function(path) {
        return !path.match(/node_modules|\.git|test/);
    }
});

jsonPackage.workspaces.nohoist = jsonPackage.workspaces.packages;
delete jsonPackage.workspaces.packages;
delete jsonPackage.scripts;
fs.writeFileSync(
    path.resolve(dir, 'package.json'),
    JSON.stringify(jsonPackage, null, '  ') + '\n'
);

console.log('Installing production dependencies...');
childProcess.execSync('yarn --production -s', {
    cwd: dir,
    stdio: [0, 1, 2]
});

delete jsonPackage.dependencies;
delete jsonPackage.devDependencies;

fs.writeFileSync(
    path.resolve(dir, 'package.json'),
    JSON.stringify(jsonPackage, null, '  ') + '\n'
);

console.log('Moving node_modules to lib directory...');

wrench.copyDirSyncRecursive(
    path.resolve(dir, 'node_modules'),
    path.resolve(dir, 'lib', 'node_modules')
);
wrench.rmdirSyncRecursive(path.resolve(dir, 'node_modules'));

console.log('Testing bower on sample project...');

childProcess.execSync(
    'cd test/sample && rm -rf bower_components && ' +
        dir +
        '/bin/bower install --force',
    { stdio: [0, 1, 2] }
);

var expectedPackages = (
    'SHA-1 ace-builds almond angular angular-animate angular-bootstrap angular-charts angular-contenteditable ' +
    'angular-deckgrid angular-fullscreen angular-gravatar angular-hotkeys angular-local-storage angular-marked ' +
    'angular-moment angular-sanitize angular-touch angular-ui-router angular-ui-sortable ' +
    'angulartics asEvented bootstrap coffee-script d3 es6-shim font-awesome howler jquery ' +
    'jquery-ui jquery-waypoints js-beautify lodash lz-string marked moment ng-file-upload peerjs ' +
    'requirejs restangular slimScroll slimScrollHorizontal venturocket-angular-slider'
).split(' ');

var installedPackages = fs.readdirSync('./test/sample/bower_components');

var installedDiff = arraydiff(expectedPackages, installedPackages);

if (installedDiff.length > 0) {
    console.log('ERROR. Some packages were not installed by bower: ');
    console.log(installedDiff.join(', '));

    process.exit(1);
}

console.log('All done!')
console.log('You need to publish prerelease and release manually:')
console.log('')
console.log('- cd ' + dir)
console.log('- npm publish --tag beta')
console.log('- npm dist-tag add bower@' + jsonPackage.version + ' latest')
