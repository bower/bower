var Q = require('q');
var expect = require('expect.js');
var helpers = require('../helpers');

var fakeRepositoryFactory = function (canonicalDir, pkgMeta) {
    function FakeRepository() { }

    FakeRepository.prototype.fetch = function() {
        return Q.fcall(function () {
            return [canonicalDir, pkgMeta];
        });
    };

    FakeRepository.prototype.getRegistryClient = function() {
        return {
            register: function (name, url, cb) {
                cb(null, { name: name, url: url });
            }
        };
    };

    return FakeRepository;
};

var register = helpers.command('register');

var registerFactory = function (canonicalDir, pkgMeta) {
    return helpers.command('register', {
        '../core/PackageRepository': fakeRepositoryFactory(
            canonicalDir, pkgMeta
        )
    });
};

describe('bower register', function () {

    var package = new helpers.TempDir({
        'bower.json': {
            name: 'package'
        }
    });

    it('errors if name is not provided', function (done) {
        return helpers.run(register)
        .fail(helpers.ensureDone(done, function(reason) {
            expect(reason.message).to.be('Usage: bower register <name> <url>');
            expect(reason.code).to.be('EINVFORMAT');
        }));
    });

    it('errors if url is not provided', function (done) {
        return helpers.run(register, ['some-name'])
        .fail(helpers.ensureDone(done, function(reason) {
            expect(reason.message).to.be('Usage: bower register <name> <url>');
            expect(reason.code).to.be('EINVFORMAT');
        }));
    });

    it('errors if url is not correct', function (done) {
        return helpers.run(register, ['some-name', 'url'])
        .fail(helpers.ensureDone(done, function(reason) {
            expect(reason.message).to.be('The registry only accepts URLs starting with git://');
            expect(reason.code).to.be('EINVFORMAT');
        }));
    });

    it('errors if trying to register private package', function (done) {
        package.prepare({ 'bower.json': { private: true } });

        var register = registerFactory(package.path, package.meta());
        return helpers.run(register, ['some-name', 'git://fake-url.git'])
        .fail(helpers.ensureDone(done, function(reason) {
            expect(reason.message).to.be('The package you are trying to register is marked as private');
            expect(reason.code).to.be('EPRIV');
        }));
    });

    it('should call registry client with name and url', function (done) {
        package.prepare();

        var register = registerFactory(package.path, package.meta());
        return helpers.run(register, ['some-name', 'git://fake-url.git'])
        .spread(helpers.ensureDone(done, function(result) {
            expect(result).to.eql({
                // Result from register action on stub
                name: 'some-name', url: 'git://fake-url.git'
            });
        }));
    });

    it('should confirm in interactive mode', function (done) {
        package.prepare();

        var register = registerFactory(package.path, package.meta());

        var promise = helpers.run(register,
            ['some-name', 'git://fake-url.git', { interactive: true }]
        );

        return helpers.expectEvent(promise.logger, 'confirm')
        .spread(helpers.ensureDone(done, function(e) {
            expect(e.type).to.be('confirm');
            expect(e.message).to.be('Registering a package will make it installable via the registry (\u001b[4m\u001b[36mhttps://bower.herokuapp.com\u001b[39m\u001b[24m), continue?');
            expect(e.default).to.be(true);
        }));
    });

    it('should skip confirming when forcing', function (done) {
        package.prepare();

        var register = registerFactory(package.path, package.meta());

        var promise = helpers.run(register,
            ['some-name', 'git://fake-url.git', { interactive: true, force: true }]
        );

        return helpers.expectEvent(promise.logger, 'end')
        .spread(helpers.ensureDone(done));
    });
});
