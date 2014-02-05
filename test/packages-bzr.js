var fs = require('graceful-fs');
var path = require('path');
var Q = require('q');
var semver = require('semver');
var mout = require('mout');
var rimraf = require('rimraf');
var mkdirp = require('mkdirp');
var chalk = require('chalk');
var cmd = require('../lib/util/cmd');
var packages = require('./packages-bzr.json');
var nopt = require('nopt');

var options = nopt({
    'force': Boolean
}, {
    'f': '--force'
});

var env = {
    'BZR_EMAIL': 'Stephen Stewart <stephen.stewart@canonical.com>'
};

// Preserve the original environment
mout.object.mixIn(env, process.env);

function ensurePackage(dir) {
    var promise;

    // If force is specified, delete folder
    if (options.force) {
        promise = Q.nfcall(rimraf, dir)
        .then(function () {
            throw new Error();
        });
    // Otherwise check if .bzr is already created
    } else {
        promise = Q.nfcall(fs.stat, path.join(dir, '.bzr'));
    }

    // Only create if stat failed
    return promise.fail(function () {
        // Create dir
        return Q.nfcall(mkdirp, dir)
        // Init bzr repo
        .then(cmd.bind(null, 'bzr', ['init'], { cwd: dir }))
        // Create dummy file
        .then(function () {
            return Q.nfcall(fs.writeFile, path.join(dir, '.master'), 'foo bar baz');
        })
        // Stage files
        .then(cmd.bind(null, 'bzr', ['add'], { cwd: dir }))
        // Commit
        .then(function () {
            return cmd('bzr', ['commit', '-m"Initial commit."'], {
                cwd: dir,
                env: env
            });
        })
        .then(function () {
            return dir;
        });
    });
}

function checkRelease(dir, release) {
    if (semver.valid(release)) {
        return cmd('bzr', ['tags'], { cwd: dir })
        .spread(function (stdout) {
            return stdout.split(/\s*\r*\n\s*/).some(function (tag) {
                return semver.clean(tag) === release;
            });
        });
    }

}

function createRelease(dir, release, files) {
    var branch = semver.valid(release) ? 'branch-' + release : release;

    // Checkout master
    var promise;
    var promises = [];

    mout.object.forOwn(files, function (contents, name) {
        name = path.join(dir, name);

        // Convert contents to JSON if they are not a string
        if (typeof contents !== 'string') {
            contents = JSON.stringify(contents, null, '  ');
        }

        promise = Q.nfcall(mkdirp, path.dirname(name))
        .then(function () {
            return Q.nfcall(fs.writeFile, name, contents);
        });

        promises.push(promise);
    });

    return Q.all(promises)
    // Stage files
    .then(cmd.bind(null, 'bzr', ['add'], { cwd: dir }))
    // Commit
    .then(function () {
        return cmd('bzr', ['commit', '-m"Commit for ' + branch + '."', '--unchanged'], {
            cwd: dir,
            env: env
        });
    })
    // Tag
    .then(function () {
        if (!semver.valid(release)) {
            return;
        }

        return cmd('bzr', ['tag', release], { cwd: dir });
    });
}

var promises = [];

// Process packages.json
mout.object.forOwn(packages, function (pkg, name) {
    var promise;
    var dir = path.join(__dirname, 'assets', name);

    // Ensure package is created
    promise = ensurePackage(dir);
    promise = promise.fail(function (err) {
        console.log('Failed to create ' + name);
        console.log(err.message);
    });

    mout.object.forOwn(pkg, function (files, release) {
        // Check if the release already exists
        promise = promise.then(checkRelease.bind(null, dir, release))
        .then(function (exists) {
            // Skip it if already created
            if (exists) {
                return console.log(chalk.cyan('> ') + 'Package ' + name + '#' + release + ' already created');
            }

            // Create it based on the metadata
            return createRelease(dir, release, files)
            .then(function () {
                console.log(chalk.green('> ') + 'Package ' + name + '#' + release + ' successfully created');
            });
        })
        .fail(function (err) {
            console.log(chalk.red('> ') + 'Failed to create ' + name + '#' + release);
            console.log(err.message.trim());
            if (err.details) {
                console.log(err.details.trim());
            }
            console.log(err.stack);
        });
    });

    promises.push(promise);
});

Q.allSettled(promises, function (results) {
    results.forEach(function (result) {
        if (result.state !== 'fulfilled') {
            process.exit(1);
        }
    });
});
