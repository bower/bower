var cp = require('child_process');
var Q = require('q');
var createError = require('./createError');

// Executes a shell command
// Buffers the stdout and stderr
// If an error occurs, a meaningfull error is generated

function cmd(command, args, options) {
    var process,
        stderr = '',
        stdout = '',
        deferred = Q.defer();

    process = cp.spawn(command, args, options);
    process.stdout.on('data', function (data) { stdout += data.toString(); });
    process.stderr.on('data', function (data) { stderr += data.toString(); });

    process.on('close', function (code) {
        var fullCommand,
            error;

        process.removeAllListeners();

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

        return deferred.resolve(stdout);
    });

    return deferred.promise;
}

module.exports = cmd;