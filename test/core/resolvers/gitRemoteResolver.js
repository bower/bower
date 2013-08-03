var expect = require('expect.js');
var path = require('path');
var fs = require('graceful-fs');
var Logger = require('bower-logger');
var GitRemoteResolver = require('../../../lib/core/resolvers/GitRemoteResolver');
var defaultConfig = require('../../../lib/config');

describe('GitRemoteResolver', function () {
    var testPackage = path.resolve(__dirname, '../../assets/package-a');
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
            expect(resolver.getName()).to.equal('package-a');

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
            var resolver = create({ source: 'file://' + testPackage, target: 'd76bab9456cc3deac73bc4f227ae7ad00bff7d72' });

            resolver.resolve()
            .then(function (dir) {
                expect(dir).to.be.a('string');

                var files = fs.readdirSync(dir);

                expect(files).to.not.contain('foo');
                expect(files).to.not.contain('bar');
                expect(files).to.not.contain('baz');
                expect(files).to.contain('.master');
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
                // Remove master and test only for the first 7 refs
                refs = refs.slice(1, 8);

                expect(refs).to.eql([
                    'db2829610b1e31386d711b5be5fda8e3f750a59a refs/heads/some-branch',
                    '3be150401b59377511630a5d4e4da3b3c8c494d3 refs/tags/0.0.1',
                    '5edabebb4e066a89cdae3ec113f23e248bce4244 refs/tags/0.0.2',
                    'def32c2d04ff2b0f42a0c4df3018de743b637806 refs/tags/0.1.0',
                    '3c81d66fd6684b7fb26f42a94714605ea5ef915c refs/tags/0.1.1',
                    '2f29c23ddc716b6f38260d98c9b75c32c9c51800 refs/tags/0.2.0',
                    '420d368a2d85b5a1b6f1ce74f2ca26827fdc3e32 refs/tags/0.2.1'
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
                // Test only for the first 7 refs
                refs = refs.slice(0, 7);

                expect(refs).to.eql([
                    'db2829610b1e31386d711b5be5fda8e3f750a59a refs/heads/some-branch',
                    '3be150401b59377511630a5d4e4da3b3c8c494d3 refs/tags/0.0.1',
                    '5edabebb4e066a89cdae3ec113f23e248bce4244 refs/tags/0.0.2',
                    'def32c2d04ff2b0f42a0c4df3018de743b637806 refs/tags/0.1.0',
                    '3c81d66fd6684b7fb26f42a94714605ea5ef915c refs/tags/0.1.1',
                    '2f29c23ddc716b6f38260d98c9b75c32c9c51800 refs/tags/0.2.0',
                    '420d368a2d85b5a1b6f1ce74f2ca26827fdc3e32 refs/tags/0.2.1'
                ]);
                next();
            })
            .done();
        });
    });
});
