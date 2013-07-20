var expect = require('expect.js');
var path = require('path');
var fs = require('graceful-fs');
var Logger = require('bower-logger');
var GitRemoteResolver = require('../../../lib/core/resolvers/GitRemoteResolver');
var defaultConfig = require('../../../lib/config');

describe('GitRemoteResolver', function () {
    var testPackage = path.resolve(__dirname, '../../assets/github-test-package');
    var logger;

    before(function () {
        logger = new Logger();
    });

    afterEach(function () {
        logger.removeAllListeners();
    });

    function clearResolverRuntimeCache() {
        GitRemoteResolver.clearRuntimeCache();
    }

    function create(decEndpoint, config) {
        if (typeof decEndpoint === 'string') {
            decEndpoint = { source: decEndpoint };
        }

        return new GitRemoteResolver(decEndpoint, config || defaultConfig, logger);
    }

    describe('.constructor', function () {
        it('should guess the name from the path', function () {
            var resolver;

            resolver = create('file://' + testPackage);
            expect(resolver.getName()).to.equal('github-test-package');

            resolver = create('git://github.com/twitter/bower.git');
            expect(resolver.getName()).to.equal('bower');

            resolver = create('git://github.com/twitter/bower');
            expect(resolver.getName()).to.equal('bower');

            resolver = create('git://github.com');
            expect(resolver.getName()).to.equal('github.com');
        });

        it('should ensure .git in the source (except if protocol is file://)', function () {
            var resolver;

            resolver = create('git://github.com/twitter/bower');
            expect(resolver.getSource()).to.equal('git://github.com/twitter/bower.git');

            resolver = create('git://github.com/twitter/bower.git');
            expect(resolver.getSource()).to.equal('git://github.com/twitter/bower.git');

            resolver = create('git://github.com/twitter/bower.git/');
            expect(resolver.getSource()).to.equal('git://github.com/twitter/bower.git');

            resolver = create('file://' + testPackage);
            expect(resolver.getSource()).to.equal('file://' + testPackage);
        });
    });

    describe('.resolve', function () {
        it('should checkout correctly if resolution is a branch', function (next) {
            var resolver = create({ source: 'file://' + testPackage, target: 'some-branch' });

            resolver.resolve()
            .then(function (dir) {
                expect(dir).to.be.a('string');

                var files = fs.readdirSync(dir);
                var fooContents;

                expect(files).to.contain('foo');
                expect(files).to.contain('baz');
                expect(files).to.contain('baz');

                fooContents = fs.readFileSync(path.join(dir, 'foo')).toString();
                expect(fooContents).to.equal('foo foo');

                next();
            })
            .done();
        });

        it('should checkout correctly if resolution is a tag', function (next) {
            var resolver = create({ source: 'file://' + testPackage, target: '~0.0.1' });

            resolver.resolve()
            .then(function (dir) {
                expect(dir).to.be.a('string');

                var files = fs.readdirSync(dir);

                expect(files).to.contain('foo');
                expect(files).to.contain('bar');
                expect(files).to.not.contain('baz');

                next();
            })
            .done();
        });

        it('should checkout correctly if resolution is a commit', function (next) {
            var resolver = create({ source: 'file://' + testPackage, target: '7339c38f5874129504b83650fbb2d850394573e9' });

            resolver.resolve()
            .then(function (dir) {
                expect(dir).to.be.a('string');

                var files = fs.readdirSync(dir);

                expect(files).to.not.contain('foo');
                expect(files).to.not.contain('bar');
                expect(files).to.not.contain('baz');
                expect(files).to.contain('README.md');
                next();
            })
            .done();
        });

        it.skip('should report progress when it takes too long to clone');
    });

    describe('#refs', function () {
        afterEach(clearResolverRuntimeCache);

        it('should resolve to the references of the remote repository', function (next) {
            GitRemoteResolver.refs('file://' + testPackage)
            .then(function (refs) {
                // Remove master and test only for the first 13 refs
                refs = refs.slice(1, 14);

                expect(refs).to.eql([
                    '8b03dbbe20e0bc4f1fae2811ea0063121eb1b155 refs/heads/some-branch',
                    '122ac45fd22671a23cf77055a32d06d5a7baedd0 refs/tags/0.0.1',
                    '19b3a35cc7fded9a8a60d5b8fc0d18eb4940c476 refs/tags/0.0.1^{}',
                    '34dd75a11e686be862844996392e96e9457c7467 refs/tags/0.0.2',
                    'ddc6ea571c49c1ab8bb213fda18efdfe2bc8dd00 refs/tags/0.0.2^{}',
                    '92327598500f115d09ab14f16cde23718fc87658 refs/tags/0.1.0',
                    'b273e321ebc69381be2780668a22e28bec9e2b07 refs/tags/0.1.0^{}',
                    '192bc846a342eb8ae62bb1a54d1394959e6fcd92 refs/tags/0.1.1',
                    'f99467d1069892ea639b6a3d2afdbff6ac62f44e refs/tags/0.1.1^{}',
                    'a920e518bc9eda908018ea299cad48d358a111ce refs/tags/0.2.0',
                    '65dc372d73c76ed4904ee209ed77c09d44f4dc53 refs/tags/0.2.0^{}',
                    '2fe77b16a065ca5b8f0076a9984ae629e5472d7c refs/tags/0.2.1',
                    'c2cc010b8ee65737c55d63e4c67cba8fb9a00d7f refs/tags/0.2.1^{}'
                ]);
                next();
            })
            .done();
        });

        it('should cache the results', function (next) {
            var source = 'file://' + testPackage;

            GitRemoteResolver.refs(source)
            .then(function () {
                // Manipulate the cache and check if it resolves for the cached ones
                GitRemoteResolver._cache.refs.get(source).splice(0, 1);

                // Check if it resolver to the same array
                return GitRemoteResolver.refs('file://' + testPackage);
            })
            .then(function (refs) {
                // Test only for the first 12 refs
                refs = refs.slice(0, 13);

                expect(refs).to.eql([
                    '8b03dbbe20e0bc4f1fae2811ea0063121eb1b155 refs/heads/some-branch',
                    '122ac45fd22671a23cf77055a32d06d5a7baedd0 refs/tags/0.0.1',
                    '19b3a35cc7fded9a8a60d5b8fc0d18eb4940c476 refs/tags/0.0.1^{}',
                    '34dd75a11e686be862844996392e96e9457c7467 refs/tags/0.0.2',
                    'ddc6ea571c49c1ab8bb213fda18efdfe2bc8dd00 refs/tags/0.0.2^{}',
                    '92327598500f115d09ab14f16cde23718fc87658 refs/tags/0.1.0',
                    'b273e321ebc69381be2780668a22e28bec9e2b07 refs/tags/0.1.0^{}',
                    '192bc846a342eb8ae62bb1a54d1394959e6fcd92 refs/tags/0.1.1',
                    'f99467d1069892ea639b6a3d2afdbff6ac62f44e refs/tags/0.1.1^{}',
                    'a920e518bc9eda908018ea299cad48d358a111ce refs/tags/0.2.0',
                    '65dc372d73c76ed4904ee209ed77c09d44f4dc53 refs/tags/0.2.0^{}',
                    '2fe77b16a065ca5b8f0076a9984ae629e5472d7c refs/tags/0.2.1',
                    'c2cc010b8ee65737c55d63e4c67cba8fb9a00d7f refs/tags/0.2.1^{}'
                ]);
                next();
            })
            .done();
        });
    });
});
