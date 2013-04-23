var path = require('path');
var fs = require('fs');
var expect = require('expect.js');
var path = require('path');
var GitFsResolver = require('../../../lib/resolve/resolvers/GitFsResolver');

describe('GitFsResolver', function () {
    var testPackage = path.resolve(__dirname, '../../assets/github-test-package');

    function cleanInternalResolverCache() {
        delete GitFsResolver._versions;
        delete GitFsResolver._heads;
        delete GitFsResolver._refs;
    }

    describe('.resolve', function () {
        it('should checkout correctly if resolution is a branch', function (next) {
            var resolver = new GitFsResolver(testPackage, { target: 'some-branch' });

            resolver.resolve()
            .then(function (dir) {
                expect(dir).to.be.a('string');

                var files = fs.readdirSync(dir),
                    fooContents;

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
            var resolver = new GitFsResolver(testPackage, { target: '~0.0.1' });

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
            var resolver = new GitFsResolver(testPackage, { target: '7339c38f5874129504b83650fbb2d850394573e9' });

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
            var resolver = new GitFsResolver(testPackage, { target: '7339c38f5874129504b83650fbb2d850394573e9' });

            fs.writeFileSync(path.join(testPackage, 'new-file'), 'foo');
            fs.mkdir(path.join(testPackage, 'new-dir'));

            resolver.resolve()
            .then(function (dir) {
                expect(dir).to.be.a('string');

                var files = fs.readdirSync(dir);

                expect(files).to.not.contain('new-file');
                expect(files).to.not.contain('new-dir');
                next();
            })
            .done();
        });
    });

    describe('._copy', function () {
        it('should copy files from the source to the temporary directory');
        it('should not copy over the files specified in the ignore list');
    });

    describe('#fetchRefs', function () {
        afterEach(cleanInternalResolverCache);

        it('should resolve to the references of the local repository', function (next) {
            GitFsResolver.fetchRefs(testPackage)
            .then(function (refs) {
                expect(refs).to.eql([
                    'b273e321ebc69381be2780668a22e28bec9e2b07 refs/heads/master',
                    '8b03dbbe20e0bc4f1fae2811ea0063121eb1b155 refs/heads/some-branch',
                    '122ac45fd22671a23cf77055a32d06d5a7baedd0 refs/tags/0.0.1',
                    '34dd75a11e686be862844996392e96e9457c7467 refs/tags/0.0.2',
                    '92327598500f115d09ab14f16cde23718fc87658 refs/tags/0.1.0',
                    '192bc846a342eb8ae62bb1a54d1394959e6fcd92 refs/tags/0.1.1'
                ]);
                next();
            })
            .done();
        });

        it('should cache the results', function (next) {
            GitFsResolver.fetchRefs(testPackage)
            .then(function () {
                expect(GitFsResolver._refs).to.be.an('object');
                expect(GitFsResolver._refs[testPackage]).to.be.an('array');

                // Manipulate the cache and check if it resolves for the cached ones
                GitFsResolver._refs[testPackage].splice(0, 1);

                // Check if it resolver to the same array
                return GitFsResolver.fetchRefs(testPackage);
            })
            .then(function (refs) {
                expect(refs).to.eql([
                    '8b03dbbe20e0bc4f1fae2811ea0063121eb1b155 refs/heads/some-branch',
                    '122ac45fd22671a23cf77055a32d06d5a7baedd0 refs/tags/0.0.1',
                    '34dd75a11e686be862844996392e96e9457c7467 refs/tags/0.0.2',
                    '92327598500f115d09ab14f16cde23718fc87658 refs/tags/0.1.0',
                    '192bc846a342eb8ae62bb1a54d1394959e6fcd92 refs/tags/0.1.1'
                ]);
                next();
            })
            .done();
        });
    });
});