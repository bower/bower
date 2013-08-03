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
    var testPackage = path.resolve(__dirname, '../../assets/package-a');
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

            expect(resolver.getName()).to.equal('package-a');
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
            var resolver = create({ source: testPackage, target: 'd76bab9456cc3deac73bc4f227ae7ad00bff7d72' });

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

        it('should remove any untracked files and directories', function (next) {
            var resolver = create({ source: testPackage, target: 'd76bab9456cc3deac73bc4f227ae7ad00bff7d72' });
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

            tempSource = path.resolve(__dirname, '../../assets/package-a-copy');
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
