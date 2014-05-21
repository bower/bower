var mout = require('mout');
var semver = require('semver');
var Logger = require('bower-logger');
var which = require('which');
var fs = require('fs');
var path = require('path');
var Q = require('q');
var execFile = require('child_process').execFile;
var Project = require('../core/Project');
var cli = require('../util/cli');
var defaultConfig = require('../config');
var createError = require('../util/createError');

var rootDir;

var git = function (args) {
    return Q.nfcall(execFile, 'git', args, {
        env: process.env,
        cwd: rootDir
    });
};

function version(versionArg, options, config) {
    var project;
    var logger = new Logger();

    config = mout.object.deepFillIn(config || {}, defaultConfig);
    project = new Project(config, logger);

    rootDir = project.getRootDir();

    bump(project, versionArg, options.message)
    .done(function () {
        logger.emit('end');
    }, function (error) {
        logger.emit('error', error);
    });

    return logger;
}

function bump(project, versionArg, message) {
    var newVersion;
    var doGitCommit = false;

    return checkGit()
    .then(function (hasGit) {
        doGitCommit = hasGit;
    })
    .then(project.getJson.bind(project))
    .then(function (json) {
        newVersion = getNewVersion(json.version, versionArg);
        json.version = newVersion;
    })
    .then(project.saveJson.bind(project))
    .then(function () {
        if (doGitCommit) {
            return gitCommitAndTag(newVersion, message);
        }
    })
    .then(function () {
        console.log('v' + newVersion);
    });
}

function getNewVersion(currentVersion, versionArg) {
    var newVersion = semver.valid(versionArg);
    if (!newVersion) {
        newVersion = semver.inc(currentVersion, versionArg);
    }
    if (!newVersion) {
        throw createError('Invalid version argument: `' + versionArg + '`. Usage: `bower version [<newversion> | major | minor | patch]`', 'EINVALIDVERSION');
    }
    if (currentVersion === newVersion) {
        throw createError('Version not changed', 'EVERSIONNOTCHANGED');
    }
    return newVersion;
}

function checkGit(rootDir) {
    var gitDir = path.join(rootDir, '.git');
    return Q.nfcall(fs.stat, gitDir)
    .then(function (stat) {
        if (stat.isDirectory()) {
            return checkGitStatus();
        }
        return false;
    }, function () {
        //Ignore not found .git directory
        return false;
    });
}

function checkGitStatus() {
    return Q.nfcall(which, 'git')
    .fail(function (err) {
        err.code = 'ENOGIT';
        throw err;
    })
    .then(function () {
        return git(['status', '--porcelain']);
    })
    .then(function (value) {
        var stdout = value[0];
        var lines = filterModifiedStatusLines(stdout);
        if (lines.length) {
            throw createError('Git working directory not clean.\n' + lines.join('\n'), 'EWORKINGDIRECTORYDIRTY');
        }
        return true;
    });
}

function filterModifiedStatusLines(stdout) {
    return stdout.trim().split('\n')
    .filter(function (line) {
        return line.trim() && !line.match(/^\?\? /);
    }).map(function (line) {
        return line.trim();
    });
}

function gitCommitAndTag(newVersion, message) {
    message = message || 'v' + newVersion;
    message = message.replace(/%s/g, newVersion);
    return git(['add', 'bower.json'])
    .then(function () {
        return git(['commit', '-m', message]);
    })
    .then(function () {
        return git(['tag', newVersion, '-am', message]);
    });
}

// -------------------

version.line = function (argv) {
    var options = version.options(argv);
    return version(options.argv.remain[1], options);
};

version.options = function (argv) {
    return cli.readOptions({
        'message': { type: String, shorthand: 'm'}
    }, argv);
};

version.completion = function () {
    // TODO:
};

module.exports = version;
