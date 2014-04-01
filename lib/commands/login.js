var Configstore = require('configstore');
var GitHub = require('github');
var Q = require('q');

var createError = require('../util/createError');
var defaultConfig = require('../config');

function login(logger, options, config) {
    var configstore = new Configstore('bower-github');

    config = defaultConfig(config);

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
                'message': 'Username',
                'type': 'input',
                'default': configstore.get('username')
            },
            {
                'name': 'password',
                'message': 'Password',
                'type': 'password'
            }
        ];

        var github = new GitHub({
            version: '3.0.0'
        });

        promise = Q.nfcall(logger.prompt.bind(logger), questions)
        .then(function (answers) {
            configstore.set('username', answers.username);

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

    promise
    .fail(function (error) {
        logger.error('login error', 'Could not authenticate');
    })
    .then(function (result) {
        configstore.set('accessToken', result.token);

        logger.emit('end', result);
    });

    return logger;
}

// -------------------

login.readOptions = function (argv) {
    var cli = require('../util/cli');

    var options = cli.readOptions({
        token: { type: String, shorthand: 't' },
    }, argv);

    delete options.argv;

    return [options];
};

module.exports = login;
