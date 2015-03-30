var expect = require('expect.js');
var helpers = require('../helpers');

var fakeGitHub = function (authenticate) {
    function FakeGitHub() { }

    var _authenticated = false;

    FakeGitHub.prototype.authenticate = function (creds) {
        if (creds.password === 'validpassword') {
            _authenticated = true;
        }
    };

    FakeGitHub.prototype.authorization = {
        create: function (options, cb) {
            if (_authenticated) {
                cb(null, { token: 'faketoken' });
            } else {
                cb('Not authenticated');
            }
        }
    };

    return FakeGitHub;
};

var fakeConfigstore = function (set, get) {
    function FakeConfigstore() { }

    FakeConfigstore.prototype.set = set;
    FakeConfigstore.prototype.get = get;

    return FakeConfigstore;
};

var login = helpers.command('login');

var loginFactory = function (options) {
    return helpers.command('login', {
        'github': fakeGitHub(),
        'configstore': fakeConfigstore(
            options.set || function () { return true; },
            options.get || function () { return true; }
        )
    });
};

describe('bower login', function () {

    it('correctly reads arguments', function() {
        expect(login.readOptions(['--token', 'foobar']))
        .to.eql([{ token: 'foobar' }]);
    });

    it('fails if run in non-interactive shell without token passed', function () {
        return helpers.run(login, []).fail(function(reason) {
            expect(reason.message).to.be('Login requires an interactive shell');
            expect(reason.code).to.be('ENOINT');
        });
    });

    it('succeeds if run in non-interactive shell with token passed', function () {
        return helpers.run(login, [{ token: 'foobar' }]);
    });

    it('succeeds if provided password is valid', function () {
        var login = loginFactory({});

        var logger = login({}, { interactive: true });

        logger.once('prompt', function (prompt, answer) {
            answer({
                username: 'user',
                password: 'validpassword'
            });
        });

        return helpers.expectEvent(logger, 'end')
        .spread(function(options) {
            expect(options.token).to.be('faketoken');
        });
    });

    it('fails if provided password is invalid', function () {
        var login = loginFactory({});

        var logger = login({}, { interactive: true });

        logger.once('prompt', function (prompt, answer) {
            answer({
                username: 'user',
                password: 'invalidpassword'
            });
        });

        return helpers.expectEvent(logger, 'log').spread(function (log) {
            expect(log.level).to.be('error');
            expect(log.id).to.be('login error');
            expect(log.message).to.be('Could not authenticate');
        });
    });

    it('uses username stored in config as default username', function () {
        var login = loginFactory({
            get: function (key) {
                if (key === 'username') {
                    return 'savedusername';
                }
            }
        });

        var logger = login({}, { interactive: true });

        return helpers.expectEvent(logger, 'prompt')
        .spread(function (prompt, answer) {
            expect(prompt[0].default).to.be('savedusername');
        });
    });

    it('saves username in config', function (done) {
        var login = loginFactory({
            set: function (key, value) {
                if(key === 'username') {
                    expect(value).to.be('user');
                    done();
                }
            }
        });

        var logger = login({}, { interactive: true });

        logger.once('prompt', function (prompt, answer) {
            answer({
                username: 'user',
                password: 'validpassword'
            });
        });
    });

    it('saves received token in accessToken config', function (done) {
        var login = loginFactory({
            set: function (key, value) {
                if(key === 'accessToken') {
                    expect(value).to.be('faketoken');
                    done();
                }
            }
        });

        var logger = login({}, { interactive: true });

        logger.once('prompt', function (prompt, answer) {
            answer({
                username: 'user',
                password: 'validpassword'
            });
        });
    });
});
