var expect = require('expect.js');
var path = require('path');
var fs = require('graceful-fs');
var path = require('path');
var rimraf = require('rimraf');
var Logger = require('bower-logger');
var cmd = require('../../../lib/util/cmd');
var copy = require('../../../lib/util/copy');
var GitFsResolver = require('../../../lib/core/resolvers/GitFsResolver');
var defaultConfig = require('../../../lib/config');

describe('GitFsResolver', function () {
    var tempSource;
    var testPackage = path.resolve(__dirname, '../../assets/github-test-package');
    var logger;

    before(function () {
        logger = new Logger();
    });

    afterEach(function (next) {
        logger.removeAllListeners();

        if (tempSource) {
            rimraf(tempSource, next);
            tempSource = null;
        } else {
            next();
        }
    });

    function clearResolverRuntimeCache() {
        GitFsResolver.clearRuntimeCache();
    }

    function create(decEndpoint, config) {
        if (typeof decEndpoint === 'string') {
            decEndpoint = { source: decEndpoint };
        }

        return new GitFsResolver(decEndpoint, config || defaultConfig, logger);
    }

    describe('.constructor', function () {
        it('should guess the name from the path', function () {
            var resolver = create(testPackage);

            expect(resolver.getName()).to.equal('github-test-package');
        });

        it('should not guess the name from the path if the name was specified', function () {
            var resolver = create({ source: testPackage, name: 'foo' });

            expect(resolver.getName()).to.equal('foo');
        });

        it('should make paths absolute and normalized', function () {
            var resolver;

            resolver = create(path.relative(process.cwd(), testPackage));
            expect(resolver.getSource()).to.equal(testPackage);

            resolver = create(testPackage + '/something/..');
            expect(resolver.getSource()).to.equal(testPackage);
        });

        it.skip('should use config.cwd for resolving relative paths');
    });

    describe('.resolve', function () {
        it('should checkout correctly if resolution is a branch', function (next) {
            var resolver = create({ source: testPackage, target: 'some-branch' });

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
            var resolver = create({ source: testPackage, target: '~0.0.1' });

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
            var resolver = create({ source: testPackage, target: '7339c38f5874129504b83650fbb2d850394573e9' });

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

        it('should remove any untracked files and directories', function (next) {
            var resolver = create({ source: testPackage, target: '7339c38f5874129504b83650fbb2d850394573e9' });
            var file = path.join(testPackage, 'new-file');
            var dir = path.join(testPackage, 'new-dir');

            fs.writeFileSync(file, 'foo');
            fs.mkdir(dir);

            function cleanup(err) {
                fs.unlinkSync(file);
                fs.rmdirSync(dir);

                if (err) {
                    throw err;
                }
            }

            resolver.resolve()
            .then(function (dir) {
                expect(dir).to.be.a('string');

                var files = fs.readdirSync(dir);

                expect(files).to.not.contain('new-file');
                expect(files).to.not.contain('new-dir');

                cleanup();
                next();
            })
            .fail(cleanup)
            .done();
        });

        it('should leave the original repository untouched', function (next) {
            // Switch to master
            cmd('git', ['checkout', 'master'], { cwd: testPackage })
            // Resolve to some-branch
            .then(function () {
                var resolver = create({ source: testPackage, target: 'some-branch' });
                return resolver.resolve();
            })
            // Check if the original branch is still the master one
            .then(function () {
                return cmd('git', ['branch', '--color=never'], { cwd: testPackage })
                .spread(function (stdout) {
                    expect(stdout).to.contain('* master');
                });
            })
            // Check if git status is empty
            .then(function () {
                return cmd('git', ['status', '--porcelain'], { cwd: testPackage })
                .spread(function (stdout) {
                    stdout = stdout.trim();
                    expect(stdout).to.equal('');
                    next();
                });
            })
            .done();
        });

        it('should copy source folder permissions', function (next) {
            var mode0777;
            var resolver;

            tempSource = path.resolve(__dirname, '../../assets/github-test-package-copy');
            resolver = create({ source: tempSource, target: 'some-branch' });

            copy.copyDir(testPackage, tempSource)
            .then(function () {
                // Change tempSource dir to 0777
                fs.chmodSync(tempSource, 0777);
                // Get the mode to a variable
                mode0777 = fs.statSync(tempSource).mode;
            })
            .then(resolver.resolve.bind(resolver))
            .then(function (dir) {
                // Check if temporary dir is 0777 instead of default 0777 & ~process.umask()
                var stat = fs.statSync(dir);
                expect(stat.mode).to.equal(mode0777);
                next();
            })
            .done();
        });
    });

    describe('#refs', function () {
        afterEach(clearResolverRuntimeCache);

        it('should resolve to the references of the local repository', function (next) {
            GitFsResolver.refs(testPackage)
            .then(function (refs) {
                // Remove master and test only for the first 7 refs
                refs = refs.slice(1, 8);

                expect(refs).to.eql([
                    '8b03dbbe20e0bc4f1fae2811ea0063121eb1b155 refs/heads/some-branch',
                    '122ac45fd22671a23cf77055a32d06d5a7baedd0 refs/tags/0.0.1',
                    '34dd75a11e686be862844996392e96e9457c7467 refs/tags/0.0.2',
                    '92327598500f115d09ab14f16cde23718fc87658 refs/tags/0.1.0',
                    '192bc846a342eb8ae62bb1a54d1394959e6fcd92 refs/tags/0.1.1',
                    'a920e518bc9eda908018ea299cad48d358a111ce refs/tags/0.2.0',
                    '2fe77b16a065ca5b8f0076a9984ae629e5472d7c refs/tags/0.2.1'
                ]);
                next();
            })
            .done();
        });

        it('should cache the results', function (next) {
            GitFsResolver.refs(testPackage)
            .then(function () {
                // Manipulate the cache and check if it resolves for the cached ones
                GitFsResolver._cache.refs.get(testPackage).splice(0, 1);

                // Check if it resolver to the same array
                return GitFsResolver.refs(testPackage);
            })
            .then(function (refs) {
                // Test only for the first 6 refs
                refs = refs.slice(0, 7);

                expect(refs).to.eql([
                    '8b03dbbe20e0bc4f1fae2811ea0063121eb1b155 refs/heads/some-branch',
                    '122ac45fd22671a23cf77055a32d06d5a7baedd0 refs/tags/0.0.1',
                    '34dd75a11e686be862844996392e96e9457c7467 refs/tags/0.0.2',
                    '92327598500f115d09ab14f16cde23718fc87658 refs/tags/0.1.0',
                    '192bc846a342eb8ae62bb1a54d1394959e6fcd92 refs/tags/0.1.1',
                    'a920e518bc9eda908018ea299cad48d358a111ce refs/tags/0.2.0',
                    '2fe77b16a065ca5b8f0076a9984ae629e5472d7c refs/tags/0.2.1'
                ]);
                next();
            })
            .done();
        });
    });
});
