var path = require('path');
var nock = require('nock');
var fs = require('graceful-fs');
var expect = require('expect.js');
var Logger = require('../../../lib/core/Logger');
var GitRemoteResolver  = require('../../../lib/core/resolvers/GitRemoteResolver');
var GitHubResolver = require('../../../lib/core/resolvers/GitHubResolver');
var defaultConfig = require('../../../lib/config');

describe('GitHub', function () {
    var logger;
    var testPackage = path.resolve(__dirname, '../../assets/github-test-package');

    before(function () {
        logger = new Logger();
    });

    afterEach(function () {
        // Clean nocks
        nock.cleanAll();

        logger.removeAllListeners();
    });

    function create(decEndpoint, config) {
        if (typeof decEndpoint === 'string') {
            decEndpoint = { source: decEndpoint };
        }

        return new GitHubResolver(decEndpoint, config || defaultConfig, logger);
    }

    describe('.resolve', function () {
        it('should download and extract the .tar.gz archive from GitHub.com', function (next) {
            var resolver;

            nock('http://github.com')
            .get('/IndigoUnited/events-emitter/archive/0.1.0.tar.gz')
            .replyWithFile(200, path.resolve(__dirname, '../../assets/package-tar.tar.gz'));

            resolver = create({ source: 'git://github.com/IndigoUnited/events-emitter.git', target: '0.1.0' });

            resolver.resolve()
            .then(function (dir) {
                expect(fs.existsSync(path.join(dir, 'foo.js'))).to.be(true);
                expect(fs.existsSync(path.join(dir, '.bower.json'))).to.be(true);
                expect(fs.existsSync(path.join(dir, 'bar.js'))).to.be(true);
                expect(fs.existsSync(path.join(dir, 'package-tar.tar.gz'))).to.be(false);
                expect(fs.existsSync(path.join(dir, 'package-tar.tar'))).to.be(false);
                next();
            })
            .done();
        });

        it('should fallback to the GitRemoteResolver mechanism if resolution is not a tag', function (next) {
            var resolver = create({ source: 'file://' + testPackage, target: 'b273e321ebc69381be2780668a22e28bec9e2b07' });
            var originalCheckout = GitRemoteResolver.prototype._checkout;
            var called;

            GitRemoteResolver.prototype._checkout = function () {
                called = true;
                return originalCheckout.apply(this, arguments);
            };

            resolver.resolve()
            .then(function (dir) {
                expect(fs.existsSync(path.join(dir, 'foo'))).to.be(true);
                expect(fs.existsSync(path.join(dir, 'bar'))).to.be(true);
                expect(fs.existsSync(path.join(dir, 'baz'))).to.be(true);
                expect(called).to.be(true);
                next();
            })
            .fin(function () {
                GitRemoteResolver.prototype._checkout = originalCheckout;
            })
            .done();
        });

        it.skip('should report progress if it takes too long to download');
    });
});
