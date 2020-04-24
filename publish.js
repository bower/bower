var tmp = require('tmp');
var fs = require('fs');
var path = require('path');

var childProcess = require('child_process');
var arraydiff = require('arr-diff');
var wrench = require('wrench');
var inquirer = require('inquirer');

var npmVersion = JSON.parse(
    childProcess.execSync('npm version --json').toString()
).npm.split('.');
var npmMajor = parseInt(npmVersion[0], 10);
var npmMinor = parseInt(npmVersion[1], 10);

var jsonPackage = require('./package');

if (npmMajor !== 3 || npmMinor < 5) {
    console.log('You need to use at npm@3.5 to publish bower.');
    console.log(
        'It is because npm 2.x produces too long paths that Windows does not handle and newer npm drops lib/node_modules'
    );
    console.log('Please upgrade it: npm install -g npm@3');
    process.exit(1);
}

if (
    childProcess
        .execSync('git rev-parse --abbrev-ref HEAD')
        .toString()
        .trim() !== 'master'
) {
    console.log('You need to release bower from the "master" branch');

    process.exit(1);
}

if (process.env.SKIP_TESTS !== '1') {
    console.log('Reinstalling dependencies...');
    childProcess.execSync('rm -rf node_modules && yarn', {
        stdio: [0, 1, 2]
    });

    console.log('Running test suite...');
    childProcess.execSync('yarn test', { stdio: [0, 1, 2] });
}

var dir = tmp.dirSync().name;

wrench.copyDirSyncRecursive(__dirname, dir, {
    forceDelete: true,
    include: function(path) {
        return !path.match(/node_modules|\.git|test/);
    }
});

console.log('Installing production dependencies...');
childProcess.execSync('yarn --production', {
    cwd: dir,
    stdio: [0, 1, 2]
});

delete jsonPackage.dependencies;
delete jsonPackage.devDependencies;
delete jsonPackage.scripts;

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

console.log('\nBower production bundle installed in:');
console.log(dir + '\n');

var questions = [
    {
        type: 'confirm',
        name: 'review',
        message: 'Did you review all the changes with "git diff"?',
        default: false
    },
    {
        type: 'confirm',
        name: 'tests',
        message: 'Are you sure all tests are passing on Travis and Appveyor?',
        default: false
    },
    {
        type: 'confirm',
        name: 'publish',
        message:
            'Are you SURE you want to publish ' +
            jsonPackage.name +
            '@' +
            jsonPackage.version +
            '?',
        default: false
    }
];

var done = this.async();

inquirer.prompt(questions, function(answers) {
    if (!answers.review || !answers.tests || !answers.publish) {
        console.log('Please publish bower after you fix this issue');

        process.exit(1);
    }

    console.log(
        '\nPlease remember to tag this release, and add a release with changelog on Github!'
    );
    console.log(
        '\nAlso, please remember to test published Bower one more time!'
    );
    console.log(
        '\nYou can promote this bower release with "npm dist-tag add bower@' +
            jsonPackage.version +
            ' latest'
    );
    console.log('\nPublishing Bower...');

    childProcess.execSync('npm publish --tag beta', {
        cwd: dir,
        stdio: [0, 1, 2]
    });

    done();
});
