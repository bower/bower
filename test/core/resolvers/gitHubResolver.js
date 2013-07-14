var path = require('path');
var nock = require('nock');
var fs = require('graceful-fs');
var expect = require('expect.js');
var Logger = require('../../../lib/core/Logger');
var GitHubResolver = require('../../../lib/core/resolvers/GitHubResolver');
var defaultConfig = require('../../../lib/config');

describe('GitHub', function () {
    var logger;

    before(function () {
        logger = new Logger();
    });

    afterEach(function () {
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

            resolver = create('git://github.com/IndigoUnited/events-emitter.git');

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

        it.skip('should report progress if it takes too long to download');
    });
});
