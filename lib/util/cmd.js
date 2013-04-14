var cp = require('child_process');
var createError = require('./createError');

// Executes a shell command

// TODO: I think we need to use spawn because it escapes args

module.exports = function (command, args, options, callback) {
    var process,
        stderr = '',
        stdout = '';

    if (!callback) {
        callback = options || args;
    }

    process = cp.spawn(command, args, options);

    process.stdout.on('data', function (data) {
        stdout += data.toString();
    });

    process.stderr.on('data', function (data) {
        stderr += data.toString();
    });

    process.on('exit', function (code) {
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
            error = createError('Failed to execute "' + fullCommand + '", exit code of #' + code, 'ECMDERR');
            error.details = stderr;
            error.exitCode = code;

            return callback(error);
        }

        return callback(null, stdout, stderr);
    });
};