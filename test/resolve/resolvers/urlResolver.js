var expect = require('expect.js');
var path = require('path');
var fs = require('fs');
var path = require('path');
var nock = require('nock');
var cmd = require('../../../lib/util/cmd');
var UrlResolver = require('../../../lib/resolve/resolvers/UrlResolver');

describe('UrlResolver', function () {
    var testPackage = path.resolve(__dirname, '../../assets/github-test-package');

    before(function (next) {
        // Checkout test package to version 0.2.1 which has a bower.json
        // with ignores
        cmd('git', ['checkout', '0.2.1'], { cwd: testPackage })
        .then(next.bind(next, null), next);
    });

    afterEach(function () {
        // Clean nocks
        nock.cleanAll();
    });

    describe('.constructor', function () {
        it('should guess the name from the URL', function () {
            var resolver = new UrlResolver('http://somedomain.com/foo.txt');

            expect(resolver.getName()).to.equal('foo.txt');
        });

        it('should remove ?part from the URL when guessing the name', function () {
            var resolver = new UrlResolver('http://somedomain.com/foo.txt?bar');

            expect(resolver.getName()).to.equal('foo.txt');
        });

        it('should not guess the name or remove ?part from the URL if not guessing', function () {
            var resolver = new UrlResolver('http://somedomain.com/foo.txt?bar', {
                name: 'baz'
            });

            expect(resolver.getName()).to.equal('baz');
        });

        it('should error out if a target was specified', function (next) {
            var resolver;

            try {
                resolver = new UrlResolver(testPackage, {
                    target: '0.0.1'
                });
            } catch (err) {
                expect(err).to.be.an(Error);
                expect(err.message).to.match(/can\'t resolve targets/i);
                expect(err.code).to.equal('ENORESTARGET');
                return next();
            }

            next(new Error('Should have thrown'));
        });
    });

    describe('.hasNew', function () {
        it.skip('should resolve to true if the server failed to respond');
        it.skip('should resolve to true if cache headers changed');
        it.skip('should resolve to false if cache headers haven\'t changed');
        it.skip('should cancel the underlying request if resolved to false');
    });

    describe('.resolve', function () {
        it.skip('should download contents');
        it.skip('should extract if source is an archive', function (next) {
            var resolver = new UrlResolver('http://somedomain.com/foo.txt');

            resolver.resolve()
            .then(function (dir) {
                expect(fs.existsSync(path.join(dir, 'foo.js'))).to.be(true);
                expect(fs.existsSync(path.join(dir, 'package-zip.zip'))).to.be(false);
                next();
            })
            .done();
        });
        it.skip('should extract if response content-type is an archive');
        it.skip('should extract if response content-disposition filename is an archive');

        // TODO: copy other tests related with extraction from the FsResolver tests
    });
});