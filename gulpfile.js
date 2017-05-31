'use strict';

var gulp = require('gulp');
const G$ = require('gulp-load-plugins')({ lazy: true });
const async = require('async');
const path = require('path');
const exec = require('child_process').exec;
const del = require('del');
const packages = require('./packages.json');
const packageNames = Object.keys(packages);
const settings = require('./gulp.json');
const PACKAGE_VAR = '{package}';

// Gulp tasks
gulp.task('install', (callback) => {
  const commands = [];
  commands.push({ cmd: 'npm install', cwd: undefined });
  packageNames.forEach(name => {
    commands.push({ cmd: 'npm install', cwd: `packages/${name}` });
  });
  runCommands(commands, callback);
});

gulp.task('deepclean', () => {
  return del(expandPaths(settings.deepClean));
});

gulp.task('link', (mode) => {
    linker(true);
});

gulp.task('unlink', (mode) => {
    linker(false);
});

// Functions
function runCommand(command, options, callback) {
    exec(command, options, function (error, stdout, stderr) {
        console.log(`${path.resolve(options.cwd || '.')} ${command}`);
        console.log(stdout);
        console.log(stderr);
        if (error !== null) {
            console.log('exec error: ', error);
        }
        callback();
    });
}

function runCommands(commands, callback) {
    async.eachSeries(commands, function (command, done) {
        runCommand(command.cmd, { cwd: command.cwd }, done);
    }, function () {
        callback();
    });
}

function linker (mode) {
    const commands = [];
    packageNames.forEach(name => {
        commands.push({ cmd: `npm ${mode ? 'link' : 'unlink'} --no-bin-links`, cwd: `packages/${name}` });
        commands.push({ cmd: `npm ${mode ? 'link' : 'unlink'} ${name} --no-bin-links`, cwd: `` });
    });
    runCommands(commands, () => {});
}

function mapPaths(globArray, project) {
    return globArray.map(path =>
        mapPath(path, project));
}

function mapPath(path, project) {
    return path.replace(PACKAGE_VAR, project);
}

function expandPaths(globArray) {
    const expandedGlob = [];
    globArray.forEach(item => {
        if (item.indexOf(PACKAGE_VAR) > 0) {
            packageNames.forEach(project => {
                expandedGlob.push(item.replace(PACKAGE_VAR, project));
            });
        } else {
            expandedGlob.push(item);
        }
    });
    return expandedGlob;
}

function wildcharPaths(globArray) {
    const expandedGlob = [];
    globArray.forEach(item => {
        if (item.indexOf(PACKAGE_VAR) > 0) {
            expandedGlob.push(item.replace(PACKAGE_VAR, '*'));
        } else {
            expandedGlob.push(item);
        }
    });
    return expandedGlob;
}