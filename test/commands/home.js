var expect = require('expect.js');
var helpers = require('../helpers');

describe('bower home', function () {

    var package = new helpers.TempDir({
        'bower.json': {
            name: 'package',
            homepage: 'http://bower.io'
        }
    });

    var wrongPackage = new helpers.TempDir({
        'bower.json': {
            name: 'package'
        }
    });

    it('opens repository home page in web browser', function (done) {
        package.prepare();

        var home = helpers.command('home', {
            opn: helpers.ensureDone(done, function(url) {
                expect(url).to.be('http://bower.io');
            })
        });

        return helpers.run(home, [package.path]);
    });

    it('opens home page of current repository', function (done) {
        package.prepare();

        var home = helpers.command('home', {
            opn: helpers.ensureDone(done, function(url) {
                expect(url).to.be('http://bower.io');
            })
        });

        return helpers.run(home, [undefined, { cwd: package.path }]);
    });

    it('errors if no homepage is set', function (done) {
        wrongPackage.prepare();

        var home = helpers.command('home', {
            opn: helpers.ensureDone(done, function(url) {
                expect(url).to.be('http://bower.io');
            })
        });

        return helpers.run(home, [wrongPackage.path])
        .fail(helpers.ensureDone(done, function(reason) {
            expect(reason.message).to.be('No homepage set for package');
            expect(reason.code).to.be('ENOHOME');
        }));
    });
});
