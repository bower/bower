var Q = require('q');
var Logger = require('bower-logger');

/**
 * Require commands only when called.
 *
 * Running `commandFactory(id)` is equivalent to `require(id)`. Both calls return
 * a command function. The difference is that `cmd = commandFactory()` and `cmd()`
 * return as soon as possible and load and execute the command asynchronously.
 */
function lazyRequire(id) {
    function command() {
        var logger = new Logger();
        var commandArgs = arguments;

        Q.try(function () {
            // call require asynchronously
            return require(id).apply(undefined, commandArgs);
        })
        .done(function (commandLogger) {
            // Forward all events to exposed logger
            commandLogger.pipe(logger);
        }, function (error) {
            logger.emit('error', error);
        });

        return logger;
    }

    function runFromArgv() {
        return require(id).line.apply(undefined, arguments);
    }

    command.line = runFromArgv;

    return command;
}


module.exports = {
    cache: {
        clean: lazyRequire('./cache/clean'),
        list: lazyRequire('./cache/list')
    },
    completion: lazyRequire('./completion'),
    help: lazyRequire('./help'),
    home: lazyRequire('./home'),
    info: lazyRequire('./info'),
    init: lazyRequire('./init'),
    install: lazyRequire('./install'),
    link: lazyRequire('./link'),
    list: lazyRequire('./list'),
    lookup: lazyRequire('./lookup'),
    prune: lazyRequire('./prune'),
    register: lazyRequire('./register'),
    search: lazyRequire('./search'),
    update: lazyRequire('./update'),
    uninstall: lazyRequire('./uninstall'),
    version: lazyRequire('./version')
};
