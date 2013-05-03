var expect = require('expect.js');
var path = require('path');
var fs = require('fs');
var path = require('path');
var nock = require('nock');
var Q = require('q');
var rimraf = require('rimraf');
var cmd = require('../../../lib/util/cmd');
var UrlResolver = require('../../../lib/resolve/resolvers/UrlResolver');

describe('UrlResolver', function () {
    var testPackage = path.resolve(__dirname, '../../assets/github-test-package');
    var tempDir = path.resolve(__dirname, '../../assets/tmp');

    before(function (next) {
        // Checkout test package version 0.2.1
        cmd('git', ['checkout', '0.2.1'], { cwd: testPackage })
        .then(next.bind(next, null), next);
    });

    afterEach(function () {
        // Clean nocks
        nock.cleanAll();
    });

    describe('.constructor', function () {
        it('should guess the name from the URL', function () {
            var resolver = new UrlResolver('http://bower.io/foo.txt');

            expect(resolver.getName()).to.equal('foo.txt');
        });

        it('should remove ?part from the URL when guessing the name', function () {
            var resolver = new UrlResolver('http://bower.io/foo.txt?bar');

            expect(resolver.getName()).to.equal('foo.txt');
        });

        it('should not guess the name or remove ?part from the URL if not guessing', function () {
            var resolver = new UrlResolver('http://bower.io/foo.txt?bar', {
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
        before(function () {
            fs.mkdirSync(tempDir);
        });

        afterEach(function (next) {
            rimraf(path.join(tempDir, '.bower.json'), next);
        });

        after(function (next) {
            rimraf(tempDir, next);
        });

        it('should resolve to true if the response is not in the 2xx range', function (next) {
            var resolver = new UrlResolver('http://bower.io/foo.js');

            nock('http://bower.io')
            .head('/foo.js')
            .reply(500);

            fs.writeFileSync(path.join(tempDir, '.bower.json'), JSON.stringify({
                name: 'foo',
                version: '0.0.0'
            }));

            resolver.hasNew(tempDir)
            .then(function (hasNew) {
                expect(hasNew).to.be(true);
                next();
            })
            .done();
        });

        it('should resolve to true if cache headers changed', function (next) {
            var resolver = new UrlResolver('http://bower.io/foo.js');

            nock('http://bower.io')
            .head('/foo.js')
            .reply(200, '', {
                'ETag': '686897696a7c876b7e',
                'Last-Modified': 'Tue, 15 Nov 2012 12:45:26 GMT'
            });

            fs.writeFileSync(path.join(tempDir, '.bower.json'), JSON.stringify({
                name: 'foo',
                version: '0.0.0',
                _cacheHeaders: {
                    'ETag': 'fk3454fdmmlw20i9nf',
                    'Last-Modified': 'Tue, 16 Nov 2012 13:35:29 GMT'
                }
            }));

            resolver.hasNew(tempDir)
            .then(function (hasNew) {
                expect(hasNew).to.be(true);
                next();
            })
            .done();
        });

        it('should resolve to false if cache headers haven\'t changed', function (next) {
            var resolver = new UrlResolver('http://bower.io/foo.js');

            nock('http://bower.io')
            .head('/foo.js')
            .reply(200, '', {
                'ETag': '686897696a7c876b7e',
                'Last-Modified': 'Tue, 15 Nov 2012 12:45:26 GMT'
            });

            fs.writeFileSync(path.join(tempDir, '.bower.json'), JSON.stringify({
                name: 'foo',
                version: '0.0.0',
                _cacheHeaders: {
                    'ETag': '686897696a7c876b7e',
                    'Last-Modified': 'Tue, 15 Nov 2012 12:45:26 GMT'
                }
            }));

            resolver.hasNew(tempDir)
            .then(function (hasNew) {
                expect(hasNew).to.be(false);
                next();
            })
            .done();
        });

        it('should resolve to true if server responds with 304 (ETag mechanism)', function (next) {
            var resolver = new UrlResolver('http://bower.io/foo.js');

            nock('http://bower.io')
            .head('/foo.js')
            .matchHeader('If-None-Match', '686897696a7c876b7e')
            .reply(304, '', {
                'ETag': '686897696a7c876b7e',
                'Last-Modified': 'Tue, 15 Nov 2012 12:45:26 GMT'
            });

            fs.writeFileSync(path.join(tempDir, '.bower.json'), JSON.stringify({
                name: 'foo',
                version: '0.0.0',
                _cacheHeaders: {
                    'ETag': '686897696a7c876b7e',
                    'Last-Modified': 'Tue, 15 Nov 2012 12:45:26 GMT'
                }
            }));

            resolver.hasNew(tempDir)
            .then(function (hasNew) {
                expect(hasNew).to.be(false);
                next();
            })
            .done();
        });

        it('should work with redirects', function (next) {
            var redirectingUrl = 'http://redirecting-url.com';
            var redirectingToUrl = 'http://bower.io';
            var resolver;

            nock(redirectingUrl)
            .head('/foo.js')
            .reply(302, '', { location: redirectingToUrl + '/foo.js' });

            nock(redirectingToUrl)
            .head('/foo.js')
            .reply(200, 'foo contents', {
                'ETag': '686897696a7c876b7e',
                'Last-Modified': 'Tue, 15 Nov 2012 12:45:26 GMT'
            });


            fs.writeFileSync(path.join(tempDir, '.bower.json'), JSON.stringify({
                name: 'foo',
                version: '0.0.0',
                _cacheHeaders: {
                    'ETag': '686897696a7c876b7e',
                    'Last-Modified': 'Tue, 15 Nov 2012 12:45:26 GMT'
                }
            }));

            resolver = new UrlResolver(redirectingUrl + '/foo.js');

            resolver.hasNew(tempDir)
            .then(function (hasNew) {
                expect(hasNew).to.be(false);
                next();
            })
            .done();
        });
    });

    describe('.resolve', function () {
        // Function to assert that the main property of the
        // package meta of a canonical package is set to the
        // expected value
        function assertMain(dir, singleFile) {
            return Q.nfcall(fs.readFile, path.join(dir, '.bower.json'))
            .then(function (contents) {
                var pkgMeta = JSON.parse(contents.toString());

                expect(pkgMeta.main).to.equal(singleFile);

                return pkgMeta;
            });
        }

        it('should download file, renaming it to index', function (next) {
            var resolver;

            nock('http://bower.io')
            .get('/foo.js')
            .reply(200, 'foo contents');

            resolver = new UrlResolver('http://bower.io/foo.js');

            resolver.resolve()
            .then(function (dir) {
                var contents;

                expect(fs.existsSync(path.join(dir, 'index.js'))).to.be(true);
                expect(fs.existsSync(path.join(dir, 'foo.js'))).to.be(false);

                contents = fs.readFileSync(path.join(dir, 'index.js')).toString();
                expect(contents).to.equal('foo contents');

                assertMain(dir, 'index.js')
                .then(next.bind(next, null));
            })
            .done();
        });

        it('should extract if source is an archive', function (next) {
            var resolver;

            nock('http://bower.io')
            .get('/package-zip.zip')
            .replyWithFile(200, path.resolve(__dirname, '../../assets/package-zip.zip'));

            resolver = new UrlResolver('http://bower.io/package-zip.zip');

            resolver.resolve()
            .then(function (dir) {
                expect(fs.existsSync(path.join(dir, 'foo.js'))).to.be(true);
                expect(fs.existsSync(path.join(dir, 'bar.js'))).to.be(true);
                expect(fs.existsSync(path.join(dir, 'package-zip.zip'))).to.be(false);
                next();
            })
            .done();
        });

        it('should extract if source is an archive (case insensitive)', function (next) {
            var resolver;

            nock('http://bower.io')
            .get('/package-zip.ZIP')
            .replyWithFile(200, path.resolve(__dirname, '../../assets/package-zip.zip'));

            resolver = new UrlResolver('http://bower.io/package-zip.ZIP');

            resolver.resolve()
            .then(function (dir) {
                expect(fs.existsSync(path.join(dir, 'foo.js'))).to.be(true);
                expect(fs.existsSync(path.join(dir, 'bar.js'))).to.be(true);
                expect(fs.existsSync(path.join(dir, 'package-zip.ZIP'))).to.be(false);
                next();
            })
            .done();
        });

        it('should copy extracted folder contents if archive contains only a folder inside', function (next) {
            var resolver;

            nock('http://bower.io')
            .get('/package-zip-folder.zip')
            .replyWithFile(200, path.resolve(__dirname, '../../assets/package-zip-folder.zip'));

            resolver = new UrlResolver('http://bower.io/package-zip-folder.zip');

            resolver.resolve()
            .then(function (dir) {
                expect(fs.existsSync(path.join(dir, 'foo.js'))).to.be(true);
                expect(fs.existsSync(path.join(dir, 'bar.js'))).to.be(true);
                expect(fs.existsSync(path.join(dir, 'package-zip'))).to.be(false);
                expect(fs.existsSync(path.join(dir, 'package-zip-folder'))).to.be(false);
                expect(fs.existsSync(path.join(dir, 'package-zip-folder.zip'))).to.be(false);
                next();
            })
            .done();
        });

        it('should extract if source is an archive and rename to index if it\'s only one file inside', function (next) {
            var resolver;

            nock('http://bower.io')
            .get('/package-zip-single-file.zip')
            .replyWithFile(200, path.resolve(__dirname, '../../assets/package-zip-single-file.zip'));

            resolver = new UrlResolver('http://bower.io/package-zip-single-file.zip');

            resolver.resolve()
            .then(function (dir) {
                expect(fs.existsSync(path.join(dir, 'index.js'))).to.be(true);
                expect(fs.existsSync(path.join(dir, 'package-zip'))).to.be(false);
                expect(fs.existsSync(path.join(dir, 'package-zip-single-file'))).to.be(false);
                expect(fs.existsSync(path.join(dir, 'package-zip-single-file.zip'))).to.be(false);
                return assertMain(dir, 'index.js')
                .then(next.bind(next, null));
            })
            .done();
        });

        it('should rename single file from a single folder to index when source is an archive', function (next) {
            var resolver;

            nock('http://bower.io')
            .get('/package-zip-folder-single-file.zip')
            .replyWithFile(200, path.resolve(__dirname, '../../assets/package-zip-folder-single-file.zip'));

            resolver = new UrlResolver('http://bower.io/package-zip-folder-single-file.zip');

            resolver.resolve()
            .then(function (dir) {
                expect(fs.existsSync(path.join(dir, 'index.js'))).to.be(true);
                expect(fs.existsSync(path.join(dir, 'package-zip'))).to.be(false);
                expect(fs.existsSync(path.join(dir, 'package-zip-folder-single-file'))).to.be(false);
                expect(fs.existsSync(path.join(dir, 'package-zip-folder-single-file.zip'))).to.be(false);

                return assertMain(dir, 'index.js')
                .then(next.bind(next, null));
            })
            .done();
        });

        it('should extract if response content-type is an archive', function (next) {
            var resolver;

            nock('http://bower.io')
            .get('/package-zip')
            .replyWithFile(200, path.resolve(__dirname, '../../assets/package-zip.zip'), {
                'Content-Type': 'application/zip'
            });

            resolver = new UrlResolver('http://bower.io/package-zip');

            resolver.resolve()
            .then(function (dir) {
                expect(fs.existsSync(path.join(dir, 'foo.js'))).to.be(true);
                expect(fs.existsSync(path.join(dir, 'bar.js'))).to.be(true);
                expect(fs.existsSync(path.join(dir, 'package-zip'))).to.be(false);
                expect(fs.existsSync(path.join(dir, 'package-zip.zip'))).to.be(false);
                next();
            })
            .done();
        });

        it('should extract if response content-disposition filename is an archive', function (next) {
            var resolver;

            nock('http://bower.io')
            .get('/package-zip')
            .replyWithFile(200, path.resolve(__dirname, '../../assets/package-zip.zip'), {
                'Content-Disposition': 'attachment; filename="package-zip.zip"'
            });

            resolver = new UrlResolver('http://bower.io/package-zip');

            resolver.resolve()
            .then(function (dir) {
                expect(fs.existsSync(path.join(dir, 'foo.js'))).to.be(true);
                expect(fs.existsSync(path.join(dir, 'bar.js'))).to.be(true);
                expect(fs.existsSync(path.join(dir, 'package-zip'))).to.be(false);
                expect(fs.existsSync(path.join(dir, 'package-zip.zip'))).to.be(false);
                next();
            })
            .done();
        });

        it('should store cache headers in the package meta', function (next) {
            var resolver;

            nock('http://bower.io')
            .get('/foo.js')
            .reply(200, 'foo contents', {
                'ETag': '686897696a7c876b7e',
                'Last-Modified': 'Tue, 15 Nov 2012 12:45:26 GMT'
            });

            resolver = new UrlResolver('http://bower.io/foo.js');

            resolver.resolve()
            .then(function (dir) {
                assertMain(dir, 'index.js')
                .then(function (pkgMeta) {
                    expect(pkgMeta._cacheHeaders).to.eql({
                        'ETag': '686897696a7c876b7e',
                        'Last-Modified': 'Tue, 15 Nov 2012 12:45:26 GMT'
                    });
                    next();
                });
            })
            .done();
        });

        it('should work with redirects', function (next) {
            var redirectingUrl = 'http://redirecting-url.com';
            var redirectingToUrl = 'http://bower.io';
            var resolver;

            nock(redirectingUrl)
            .get('/foo.js')
            .reply(302, '', {
                location: redirectingToUrl + '/foo.js'
            });

            nock(redirectingToUrl)
            .get('/foo.js')
            .reply(200, 'foo contents');

            resolver = new UrlResolver(redirectingUrl + '/foo.js');

            resolver.resolve()
            .then(function (dir) {
                var contents;

                expect(fs.existsSync(path.join(dir, 'index.js'))).to.be(true);
                expect(fs.existsSync(path.join(dir, 'foo.js'))).to.be(false);

                contents = fs.readFileSync(path.join(dir, 'index.js')).toString();
                expect(contents).to.equal('foo contents');

                assertMain(dir, 'index.js')
                .then(next.bind(next, null));
            })
            .done();
        });

        describe('content-disposition validation', function () {
            function performTest(header, extraction) {
                var resolver;

                nock('http://bower.io')
                .get('/package-zip')
                .replyWithFile(200, path.resolve(__dirname, '../../assets/package-zip.zip'), {
                    'Content-Disposition': header
                });

                resolver = new UrlResolver('http://bower.io/package-zip');

                return resolver.resolve()
                .then(function (dir) {
                    if (extraction) {
                        expect(fs.existsSync(path.join(dir, 'foo.js'))).to.be(true);
                        expect(fs.existsSync(path.join(dir, 'bar.js'))).to.be(true);
                        expect(fs.existsSync(path.join(dir, 'package-zip'))).to.be(false);
                    } else {
                        expect(fs.existsSync(path.join(dir, 'foo.js'))).to.be(false);
                        expect(fs.existsSync(path.join(dir, 'bar.js'))).to.be(false);
                        expect(fs.existsSync(path.join(dir, 'package-zip'))).to.be(false);
                        expect(fs.existsSync(path.join(dir, 'index'))).to.be(true);
                    }
                });
            }

            it('should work with and without quotes', function (next) {
                performTest('attachment; filename="package-zip.zip"', true)
                .then(function () {
                    return performTest('attachment; filename=package-zip.zip', true);
                })
                .then(next.bind(next, null))
                .done();
            });

            it('should not work with partial quotes', function (next) {
                performTest('attachment; filename="package-zip.zip', false)
                .then(function () {
                    // This one works, and the last quote is simply ignored
                    return performTest('attachment; filename=package-zip.zip"', true);
                })
                .then(next.bind(next, null))
                .done();
            });

            it('should not work if the filename contain chars other than alphanumerical, dashes, spaces and dots', function (next) {
                performTest('attachment; filename="1package01 _-zip.zip"', true)
                .then(function () {
                    return performTest('attachment; filename="package$%"', false);
                })
                .then(function () {
                    return performTest('attachment; filename=packagé', false);
                })
                .then(function () {
                    // This one works, but since the filename is truncated once a space is found
                    // the extraction will not happen because the file has no .zip extension
                    return performTest('attachment; filename=1package01 _-zip.zip"', false);
                })
                .then(function () {
                    return performTest('attachment; filename=1package01.zip _-zip.zip"', true);
                })
                .then(next.bind(next, null))
                .done();
            });

            it('should trim leading and trailing spaces', function (next) {
                performTest('attachment; filename=" package.zip "', true)
                .then(next.bind(next, null))
                .done();
            });

            it('should not work if the filename ends with a dot', function (next) {
                performTest('attachment; filename="package.zip."', false)
                .then(function () {
                    return performTest('attachment; filename="package.zip. "', false);
                })
                .then(function () {
                    return performTest('attachment; filename=package.zip.', false);
                })
                .then(function () {
                    return performTest('attachment; filename="package.zip ."', false);
                })
                .then(function () {
                    return performTest('attachment; filename="package.zip. "', false);
                })
                .then(next.bind(next, null))
                .done();
            });

            it('should be case insensitive', function (next) {
                performTest('attachment; FILENAME="package.zip"', true)
                .then(function () {
                    return performTest('attachment; filename="package.ZIP"', true);
                })
                .then(function () {
                    return performTest('attachment; FILENAME=package.zip', true);
                })
                .then(function () {
                    return performTest('attachment; filename=package.ZIP', true);
                })
                .then(next.bind(next, null))
                .done();
            });
        });
    });
});
