var semver = require('semver');
var which = require('which');
var fs = require('../util/fs');
var path = require('path');
var Q = require('q');
var execFile = require('child_process').execFile;
var defaultConfig = require('../config');
var createError = require('../util/createError');

function version(logger, versionArg, options, config) {
    options = options || {};

    config = defaultConfig(config);

    return bump(logger, config, versionArg, options.message);
}

function bump(logger, config, versionArg, message) {
    var cwd = config.cwd || process.cwd();
    var newVersion;

    if (!versionArg) {
        throw createError('No <version> agrument provided', 'EREADOPTIONS');
    }

    return driver.check(cwd)
    .then(function () {
        return Q.all([driver.versions(cwd), driver.currentVersion(cwd)]);
    })
    .spread(function (versions, currentVersion) {
        currentVersion = currentVersion || '0.0.0';

        if (semver.valid(versionArg)) {
            newVersion = semver.valid(versionArg);
        } else {
            newVersion = semver.inc(currentVersion, versionArg);

            if (!newVersion) {
                throw createError('Invalid <version> argument: ' + versionArg, 'EINVALIDVERSION', { version: versionArg });
            }
        }

        newVersion = (currentVersion[0] === 'v') ? 'v' + newVersion : newVersion;

        if (versions) {
            versions.forEach(function (version) {
                if (semver.eq(version, newVersion)) {
                    throw createError('Version exists: ' + newVersion, 'EVERSIONEXISTS', { versions: versions, newVersion: newVersion });
                }
            });
        }

        return driver.bump(cwd, newVersion, message).then(function () {
            return {
                oldVersion: currentVersion,
                newVersion: newVersion
            }
        });
    })
    .then(function (result) {
        logger.info('version', 'Bumped package version from ' + result.oldVersion + ' to ' + result.newVersion, result);

        return result.newVersion;
    });
}

var driver = {
    check: function (cwd) {
        function checkGit(cwd) {
            var gitDir = path.join(cwd, '.git');
            return Q.nfcall(fs.stat, gitDir)
            .then(function (stat) {
                if (stat.isDirectory()) {
                    return checkGitStatus(cwd);
                }
                return false;
            }, function () {
                //Ignore not found .git directory
                return false;
            });
        }

        function checkGitStatus(cwd) {
            return Q.nfcall(which, 'git')
            .fail(function (err) {
                err.code = 'ENOGIT';
                throw err;
            })
            .then(function () {
                return Q.nfcall(execFile, 'git', ['status', '--porcelain'], {env: process.env, cwd: cwd});
            })
            .then(function (value) {
                var stdout = value[0];
                var lines = filterModifiedStatusLines(stdout);
                if (lines.length) {
                    throw createError('Version bump requires clean working directory', 'EWORKINGDIRECTORYDIRTY');
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

        return checkGit(cwd).then(function (hasGit) {
            if (!hasGit) {
                throw createError('Version bump currently supports only git repositories', 'ENOTGITREPOSITORY');
            }
        });
    },
    versions: function (cwd) {
        return Q.nfcall(execFile, 'git', ['tag'], {env: process.env, cwd: cwd})
        .then(function (res) {
            var versions = res[0]
            .split(/\r?\n/)
            .filter(semver.valid);

            return versions;
        }, function () {
            return [];
        });
    },
    currentVersion: function (cwd) {
        return Q.nfcall(execFile, 'git', ['describe', '--abbrev=0', '--tags'], {env: process.env, cwd: cwd})
        .then(function (res) {
            var version = res[0]
            .split(/\r?\n/)
            .filter(semver.valid)[0];

            return version;
        }, function () {
            return undefined;
        });
    },
    bump: function (cwd, tag, message) {
        message = message || tag;
        message = message.replace(/%s/g, tag);
        return Q.nfcall(execFile, 'git', ['commit', '-m', message, '--allow-empty'], {env: process.env, cwd: cwd}) .then(function () {
            return Q.nfcall(execFile, 'git', ['tag', tag, '-am', message], {env: process.env, cwd: cwd});
        });
    }
}


version.readOptions = function (argv) {
    var cli = require('../util/cli');

    var options = cli.readOptions({
        'message': { type: String, shorthand: 'm'}
    }, argv);

    return [options.argv.remain[1], options];
};

module.exports = version;
