'use strict';

var childProcess = require('child_process');
var arraydiff = require('arr-diff');
var fs = require('fs');
var inquirer = require('inquirer');

module.exports = function (grunt) {
    require('load-grunt-tasks')(grunt);

    grunt.initConfig({
        jshint: {
            options: {
                jshintrc: '.jshintrc'
            },
            files: [
                'Gruntfile.js',
                'bin/*',
                'lib/**/*.js',
                'test/**/*.js',
                '!test/assets/**/*',
                '!test/reports/**/*',
                '!test/sample/**/*',
                '!test/tmp/**/*'
            ]
        },
        jscs: {
            options: {
                config: '.jscsrc',
                fix: true
            },
            files: [
                'Gruntfile.js',
                'bin/*',
                'lib/**/*.js',
                'test/**/*.js',
                '!test/assets/**/*',
                '!test/reports/**/*',
                '!test/sample/**/*',
                '!test/tmp/**/*'
            ]
        },
        simplemocha: {
            options: {
                reporter: 'spec',
                timeout: '15000'
            },
            full: {
                src: ['test/test.js']
            },
            short: {
                options: {
                    reporter: 'dot'
                },
                src: ['test/test.js']
            }
        },
        exec: {
            assets: {
                command: 'node test/packages.js && node test/packages-svn.js'
            },
            'assets-force': {
                command: 'node test/packages.js --force && node test/packages-svn.js --force'
            },
            cover: {
                command: 'node node_modules/istanbul/lib/cli.js cover --dir ./test/reports node_modules/mocha/bin/_mocha -- --timeout 30000 -R dot test/test.js'
            },
            coveralls: {
                command: 'npm run coveralls < test/reports/lcov.info'
            }
        },
        watch: {
            files: ['<%= jshint.files %>'],
            tasks: ['jshint', 'simplemocha:short']
        }
    });

    grunt.registerTask('assets', ['exec:assets-force']);
    grunt.registerTask('test', ['jscs', 'jshint', 'exec:assets', 'simplemocha:full']);
    grunt.registerTask('cover', 'exec:cover');
    grunt.registerTask('travis', ['jshint', 'exec:assets', 'exec:cover', 'exec:coveralls']);
    grunt.registerTask('default', 'test');

    grunt.task.registerTask('prepublish', 'Prepublish checks', function () {
        var npmVersion = JSON.parse(childProcess.execSync('npm version --json').toString()).npm.split('.');
        var npmMajor = parseInt(npmVersion[0], 10);
        var npmMinor = parseInt(npmVersion[1], 10);

        if (npmMajor !== 3 || npmMinor < 5) {
            grunt.log.writeln('You need to use at least npm@3.5 to publish bower.');
            grunt.log.writeln('It is because npm 2.x produces too long paths that Windows does not handle.');
            grunt.log.writeln('Please upgrade it: npm install -g npm');
            process.exit(1);
        }

        var bundledDependencies = require('./package').bundledDependencies;
        var dependencies = Object.keys(require('./package').dependencies);
        var missing = arraydiff(dependencies, bundledDependencies);

        if (missing.length > 0) {
            grunt.log.writeln('You need to add all bower\'s dependencies to bundledDependencies in package.json');
            grunt.log.writeln('It is to freeze all dependencies so bower does not randomly break');
            grunt.log.writeln('Following dependencies need to be added to bundledDependencies:');

            for(var i = 0; i < missing.length; i++) {
                grunt.log.writeln('    "' + missing[i] + '",\n');
            }

            process.exit(1);
        }

        var version = require('./package').version;
        var changelog = fs.readFileSync('./CHANGELOG.md');

        if (changelog.indexOf('## ' + version) === -1) {
            grunt.log.writeln('Please add changelog.md entry for this bower version (' + version + ')');

            var lastRelease = childProcess.execSync('git tag | tail -1').toString().trim();

            grunt.log.writeln('Commits since last release (' + lastRelease + '): \n');

            grunt.log.writeln(childProcess.execSync('git log --oneline ' + lastRelease + '..').toString());

            process.exit(1);
        }

        if (childProcess.execSync('git rev-parse --abbrev-ref HEAD').toString().trim() !== 'master') {
            grunt.log.writeln('You need to release bower from the "master" branch');

            process.exit(1);
        }

        grunt.log.writeln('Reinstalling dependencies...');
        childProcess.execSync('rm -rf node_modules && npm install', { stdio: [0, 1, 2] });

        grunt.log.writeln('Running test suite...');
        childProcess.execSync('grunt test', { stdio: [0, 1, 2] });

        var questions = [
            {
                type: 'confirm',
                name: 'review',
                message: 'Did you review all the changes with "git diff"?',
                default: false
            },
            {
                type: 'confirm',
                name: 'changelog',
                message: 'Are you sure the CHANGELOG.md contains all changes?',
                default: false
            },
            {
                type: 'confirm',
                name: 'tests',
                message: 'Are you sure all tests are passing on Travis and Appveyor?',
                default: false
            }
        ];

        var done = this.async();

        inquirer.prompt(questions, function (answers) {
            if (!answers.review || !answers.changelog || !answers.tests) {
                grunt.log.writeln('Please publish bower after you fix this issue');

                process.exit(1);
            }

            try {
                grunt.log.writeln('Reinstalling dependencies in production mode...');

                childProcess.execSync('rm -rf node_modules && npm install --production', { stdio: [0, 1, 2] });

                grunt.log.writeln('Testing bower on sample project...');

                childProcess.execSync(
                    'cd test/sample && rm -rf bower_components && ../../bin/bower install --force', { stdio: [0, 1, 2] }
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
                    grunt.log.writeln('ERROR. Some packages were not installed by bower: ');
                    grunt.log.writeln(installedDiff.join(', '));

                    process.exit(1);
                }
            } catch (e) {
                grunt.log.writeln('There was an error. Reverting development dependencies...');

                childProcess.execSync('npm install', { stdio: [0, 1, 2] });

                process.exit(1);
            }

            grunt.log.writeln('Everything seems OK! You are likely good to publish bower.');

            var questions = [
                {
                    type: 'confirm',
                    name: 'publish',
                    message: 'Are you SURE you want to publish bower@' + require('./package').version + '?',
                    default: false
                }
            ];

            inquirer.prompt(questions, function (answers) {
                if (!answers.publish) {
                    grunt.log.writeln('Bower publishing cancelled..');

                    childProcess.execSync('npm install', { stdio: [0, 1, 2] });

                    process.exit(1);
                }

                grunt.log.writeln('\nPlease remember to tag this relese, and add a release on Github!');
                grunt.log.writeln('\nAlso, please remember to test published Bower one more time!');
                grunt.log.writeln('\nPublishing Bower...');

                done();
            });
        });
    });
};
