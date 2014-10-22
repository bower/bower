var path = require('path');
var nock = require('nock');
var fs = require('graceful-fs');
var expect = require('expect.js');
var Logger = require('bower-logger');
var GitRemoteResolver  = require('../../../lib/core/resolvers/GitRemoteResolver');
var BitBucketResolver = require('../../../lib/core/resolvers/BitBucketResolver');
var defaultConfig = require('../../../lib/config');

describe('BitBucket', function () {
    var logger;
    var testPackage = path.resolve(__dirname, '../../assets/package-a');

    before(function () {
        logger = new Logger();
    });

    afterEach(function () {
        // Clean nocks
        nock.cleanAll();

        logger.removeAllListeners();
    });

    function create(decEndpoint) {
        if (typeof decEndpoint === 'string') {
            decEndpoint = { source: decEndpoint };
        }

        return new BitBucketResolver(decEndpoint, defaultConfig({ strictSsl: false }), logger);
    }

    describe('.constructor', function () {
        it.skip('should throw an error on invalid BitBucket URLs');

        it('should ensure .git in the source', function () {
            var resolver;

            resolver = create('git://bitbucket.org/drublic/bower-test');
            expect(resolver.getSource()).to.equal('git://bitbucket.org/drublic/bower-test.git');

            resolver = create('git://bitbucket.org/drublic/bower-test.git');
            expect(resolver.getSource()).to.equal('git://bitbucket.org/drublic/bower-test.git');

            resolver = create('git://bitbucket.org/drublic/bower-test.git/');
            expect(resolver.getSource()).to.equal('git://bitbucket.org/drublic/bower-test.git');
        });
    });

    describe('.resolve', function () {

        this.timeout(10000);  // Give some time to execute

        it('should download and extract the .tar.gz archive from bitbucket.org', function (next) {
            var resolver;

            nock('https://bitbucket.org')
            .get('/drublic/bower-test/get/0.1.0.tar.gz')
            .replyWithFile(200, path.resolve(__dirname, '../../assets/package-tar.tar.gz'));

            resolver = create({ source: 'https://bitbucket.org/drublic/bower-test.git', target: '0.1.0' });
            resolver.resolve()
            .then(function (dir) {
                expect(fs.existsSync(path.join(dir, 'foo'))).to.be(true);
                expect(fs.existsSync(path.join(dir, 'bar'))).to.be(true);
                expect(fs.existsSync(path.join(dir, 'bar'))).to.be(true);
                expect(fs.existsSync(path.join(dir, '.bower.json'))).to.be(true);
                expect(fs.existsSync(path.join(dir, 'README.md'))).to.be(true);
                expect(fs.existsSync(path.join(dir, 'package-tar.tar.gz'))).to.be(false);
                expect(fs.existsSync(path.join(dir, 'package-tar.tar'))).to.be(false);
                next();
            })
            .done();
        });

        it('should retry using the GitRemoteResolver mechanism if download failed', function (next) {
            var resolver;
            var retried;

            nock('https://bitbucket.org')
            .get('/drublic/bower-test/get/0.1.0.tar.gz')
            .reply(200, 'this is not a valid tar');

            logger.on('log', function (entry) {
                if (entry.level === 'warn' && entry.id === 'retry') {
                    retried = true;
                }
            });

            resolver = create({ source: 'git://bitbucket.org/drublic/bower-test.git', target: '0.1.0' });

            // Monkey patch source to file://
            resolver._source = 'file://' + testPackage;

            resolver.resolve()
            .then(function (dir) {
                expect(retried).to.be(true);
                expect(fs.existsSync(path.join(dir, 'foo'))).to.be(true);
                expect(fs.existsSync(path.join(dir, 'bar'))).to.be(true);
                expect(fs.existsSync(path.join(dir, 'baz'))).to.be(true);
                next();
            })
            .done();
        });

        it('should retry using the GitRemoteResolver mechanism if extraction failed', function (next) {
            var resolver;
            var retried;

            nock('https://bitbucket.org')
            .get('/drublic/bower-test/get/0.1.0.tar.gz')
            .reply(500);

            logger.on('log', function (entry) {
                if (entry.level === 'warn' && entry.id === 'retry') {
                    retried = true;
                }
            });

            resolver = create({ source: 'git://bitbucket.org/drublic/bower-test.git', target: '0.1.0' });

            // Monkey patch source to file://
            resolver._source = 'file://' + testPackage;

            resolver.resolve()
            .then(function (dir) {
                expect(retried).to.be(true);
                expect(fs.existsSync(path.join(dir, 'foo'))).to.be(true);
                expect(fs.existsSync(path.join(dir, 'bar'))).to.be(true);
                expect(fs.existsSync(path.join(dir, 'baz'))).to.be(true);
                next();
            })
            .done();
        });

        it('should fallback to the GitRemoteResolver mechanism if resolution is not a tag', function (next) {
            var resolver = create({ source: 'git://bitbucket.org/drublic/bower-test.git', target: '2af02ac6ddeaac1c2f4bead8d6287ce54269c039' });
            var originalCheckout = GitRemoteResolver.prototype._checkout;
            var called;

            GitRemoteResolver.prototype._checkout = function () {
                called = true;
                return originalCheckout.apply(this, arguments);
            };

            // Monkey patch source to file://
            resolver._source = 'file://' + testPackage;

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

        it.skip('it should error out if the status code is not within 200-299');

        it.skip('should report progress if it takes too long to download');
    });

    describe('._savePkgMeta', function () {
        it.skip('should guess the homepage if not already set');
    });
});
