var Q = require('q');
var Logger = require('bower-logger');
var config = require('../config');
var cli = require('../util/cli');

/**
 * Require commands only when called.
 *
 * Running `commandFactory(id)` is equivalent to `require(id)`. Both calls return
 * a command function. The difference is that `cmd = commandFactory()` and `cmd()`
 * return as soon as possible and load and execute the command asynchronously.
 */
function commandFactory(id) {
    if (process.env.STRICT_REQUIRE) {
        require(id);
    }

    function command() {
        var commandArgs = [].slice.call(arguments);

        return withLogger(function (logger) {
            commandArgs.unshift(logger);
            return require(id).apply(undefined, commandArgs);
        });
    }

    function runFromArgv(argv) {
        var commandArgs;
        var errorForLogger;
        var command = require(id);

        try {
            commandArgs = command.readOptions(argv);
        }
        catch (e) {
            if (e.code === cli.READ_OPTIONS_ERROR_CODE) {
                return null;
            }
            else {
                // Delay raising the error until the logger is set up so the
                // logger can handle it.
                errorForLogger = e;
            }
        }

        return withLogger(function (logger) {
            // Raise any non-read-options error so the logger can handle it.
            if (errorForLogger) {
                throw errorForLogger;
            }

            commandArgs.unshift(logger);
            return command.apply(undefined, commandArgs);
        });
    }

    function withLogger(func) {
        var logger = new Logger();

        Q.try(func, logger)
        .done(function () {
            config.restore();
            var args = [].slice.call(arguments);
            args.unshift('end');
            logger.emit.apply(logger, args);
        }, function (error) {
            config.restore();
            logger.emit('error', error);
        });

        return logger;
    }

    command.line = runFromArgv;

    return command;
}


module.exports = {
    cache: {
        clean: commandFactory('./cache/clean'),
        list: commandFactory('./cache/list'),
    },
    help: commandFactory('./help'),
    home: commandFactory('./home'),
    info: commandFactory('./info'),
    init: commandFactory('./init'),
    install: commandFactory('./install'),
    link: commandFactory('./link'),
    list: commandFactory('./list'),
    login: commandFactory('./login'),
    lookup: commandFactory('./lookup'),
    prune: commandFactory('./prune'),
    register: commandFactory('./register'),
    search: commandFactory('./search'),
    update: commandFactory('./update'),
    uninstall: commandFactory('./uninstall'),
    unregister: commandFactory('./unregister'),
    version: commandFactory('./version')
};
