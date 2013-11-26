var cp = require('child_process');
var path = require('path');
var Q = require('q');
var mout = require('mout');
var which = require('which');
var createError = require('./createError');

// The openLimit number here is kind of magic. You don't really gain a lot from
// having a large number of commands spawned at once, so it isn't super
// important for this number to be large. However, it would still be nice to
// *know* how high this number can be, rather than having to guess low.
var openLimit = 50; // How many concurrent spawn()s we will allow
var openHandles = 0; // How many concurrent spawn()s we already have
var queue = [];
var winBatchExtensions;
var winWhichCache;
var isWin = process.platform === 'win32';

if (isWin) {
    winBatchExtensions = ['.bat', '.cmd'];
    winWhichCache = {};
}

function getWindowsCommand(command) {
    var fullCommand;
    var extension;

    // Do we got the value converted in the cache?
    if (mout.object.hasOwn(winWhichCache, command)) {
        return winWhichCache[command];
    }

    // Use which to retrieve the full command, which puts the extension in the end
    try {
        fullCommand = which.sync(command);
    } catch (err) {
        return winWhichCache[command] = command;
    }

    extension = path.extname(fullCommand).toLowerCase();

    // Does it need to be converted?
    if (winBatchExtensions.indexOf(extension) === -1) {
        return winWhichCache[command] = command;
    }

    return winWhichCache[command] = fullCommand;
}

// Executes a shell command, buffering the stdout and stderr
// If an error occurs, a meaningful error is generated
// Returns a promise that gets fulfilled if the command succeeds
// or rejected if it fails
function executeCmd(command, args, options) {
    var process;
    var stderr = '';
    var stdout = '';
    var deferred = Q.defer();

    // Windows workaround for .bat and .cmd files, see #626
    if (isWin) {
        command = getWindowsCommand(command);
    }

    // Buffer output, reporting progress
    process = cp.spawn(command, args, options);
    process.stdout.on('data', function (data) {
        data = data.toString();
        deferred.notify(data);
        stdout += data;
    });
    process.stderr.on('data', function (data) {
        data = data.toString();
        deferred.notify(data);
        stderr += data;
    });

    // If there is an error spawning the command, reject the promise
    process.on('error', function (error) {
        return deferred.reject(error);
    });

    // Listen to the close event instead of exit
    // They are similar but close ensures that streams are flushed
    process.on('close', function (code) {
        var fullCommand;
        var error;

        if (code) {
            // Generate the full command to be presented in the error message
            if (!Array.isArray(args)) {
                args = [];
            }

            fullCommand = command;
            fullCommand += args.length ? ' ' + args.join(' ') : '';

            // Build the error instance
            error = createError('Failed to execute "' + fullCommand + '", exit code of #' + code, 'ECMDERR', {
                details: stderr,
                exitCode: code
            });

            return deferred.reject(error);
        }

        return deferred.resolve([stdout, stderr]);
    });

    return deferred.promise;
}

// Take an item off the queue and execute it
function queueHandler() {
    var queuedItem = queue.shift();
    var deferred = queuedItem[0];

    var promise = executeCmd.apply(null, queuedItem.slice(1));

    openHandles++;

    promise.then(function (result) {
        deferred.resolve(result);
    }, function (error) {
        deferred.reject(error);
    })
    .then(function () {
        // We've just finished executing so we know for a fact that there is now a spare open file
        // handle to be used. Execute another.
        openHandles--;

        if (queue.length > 0) {
            queueHandler();
        }
    });
}

function cmd(command, args, options) {
    var deferred = Q.defer();
    queue.push([deferred, command, args, options]);

    if (openHandles < openLimit) {
        queueHandler();
    }

    return deferred.promise;
}

module.exports = cmd;
