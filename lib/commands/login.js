var Configstore = require('configstore');
var GitHub = require('github');
var Logger = require('bower-logger');
var mout = require('mout');
var Q = require('q');

var cli = require('../util/cli');
var createError = require('../util/createError');
var defaultConfig = require('../config');

function login(options, config) {
    config = mout.object.deepFillIn(config || {}, defaultConfig);

    var logger = new Logger();
    var promise;

    if (options.token) {
        promise = Q.resolve({ token: options.token });
    } else {
        // This command requires interactive to be enabled
        if (!config.interactive) {
            process.nextTick(function () {
                logger.emit('error', createError('Login requires an interactive shell', 'ENOINT', {
                    details: 'Note that you can manually force an interactive shell with --config.interactive'
                }));
            });
            return logger;
        }

        var questions = [

            {
                'name': 'username',
                'message': 'username',
                'type': 'input'
            },
            {
                'name': 'password',
                'message': 'password',
                'type': 'password'
            }
        ];

        var github = new GitHub({
            version: '3.0.0'
        });

        promise = Q.nfcall(logger.prompt.bind(logger), questions)
        .then(function (answers) {
            github.authenticate({
                type: 'basic',
                username: answers.username,
                password: answers.password
            });

            return Q.ninvoke(github.authorization, 'create', {
                scopes: ['user', 'repo'],
                note: 'Bower command line client (' + (new Date()).toISOString() + ')'
            });
        });
    }

    promise.then(function (result) {
        var configstore = new Configstore('bower-github');
        configstore.set('token', result.token);

        logger.emit('end', result);
    })
    .fail(logger.emit.bind(logger, 'error'));

    return logger;
}

// -------------------

login.line = function (argv) {
    var options = login.options(argv);

    return login(options);
};

login.options = function (argv) {
    return cli.readOptions({
        token: { type: String, shorthand: 't' },
    }, argv);
};

login.completion = function () {
    // TODO
};

module.exports = login;
