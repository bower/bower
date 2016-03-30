var expect = require('expect.js');
var helpers = require('../helpers');
var nock = require('nock');
var path = require('path');
var Q = require('q');

var fs = require('../../lib/util/fs');
var download = require('../../lib/util/download');

describe('download', function () {

    var tempDir = new helpers.TempDir(),
        source = path.resolve(__dirname, '../assets/package-tar.tar.gz'),
        destination = tempDir.getPath('package.tar.gz');

    function downloadTest(opts) {
        var deferred = Q.defer();

        tempDir.prepare();

        opts.response(
            nock('http://bower.io', opts.nockOpts)
        );

        download(opts.sourceUrl || 'http://bower.io/package.tar.gz', opts.destinationPath || destination, opts.downloadOpts)
            .then(function (result) {
                if (opts.expect) {
                    opts.expect(result);
                    deferred.resolve();
                } else {
                    deferred.reject(new Error('Error expected. Got successful response.'));
                }
            }, function (error) {
                if (opts.expectError) {
                    opts.expectError(error);
                    deferred.resolve();
                } else {
                    deferred.reject(error);
                }
            })
            .done();

        return deferred.promise;
    }

    it('download file to directory', function () {
        return downloadTest({
            response: function (nock) {
                nock.get('/package.tar.gz').replyWithFile(200, source);
            },
            expect: function () {
                expect(fs.existsSync(destination)).to.be(true);
                expect(fs.readdirSync(tempDir.path)).to.have.length(1);
            }
        });
    });

    it('pass custom user-agent to server', function () {
        var userAgent = 'Custom User-Agent';
        return downloadTest({
            nockOpts: {
                reqheaders: {
                    'user-agent': userAgent
                }
            },
            downloadOpts: {
                headers: {
                    'User-Agent': userAgent
                }
            },
            response: function (nock) {
                nock.get('/package.tar.gz').replyWithFile(200, source);
            },
            expect: function () {
                expect(fs.existsSync(destination)).to.be(true);
                expect(fs.readdirSync(tempDir.path)).to.have.length(1);
            }
        });
    });

    it('handle server response 404', function () {
        return downloadTest({
            response: function (nock) {
                nock.get('/package.tar.gz').reply(404);
            },
            expectError: function () {
                expect(fs.readdirSync(tempDir.path)).to.be.empty();
            }
        });
    });

    it('handle network error', function () {
        return downloadTest({
            response: function (nock) {
                nock.get('/package.tar.gz').replyWithError('network error');
            },
            expectError: function () {
                expect(fs.readdirSync(tempDir.path)).to.be.empty();
            }
        });
    });


    it('handles connection timeout', function () {
        return downloadTest({
            response: function (nock) {
                // First connection + 5 retries
                nock.get('/package.tar.gz').times(6).delayConnection(1000).replyWithFile(200, source);
            },
            expectError: function (e) {
                expect(e.code).to.be('ETIMEDOUT');
                expect(fs.readdirSync(tempDir.path)).to.be.empty();
            },
            downloadOpts: {
                timeout: 10,
                maxTimeout: 0,
                minTimeout: 0
            }
        });
    });

    it('handles socket timeout', function () {
        return downloadTest({
            response: function (nock) {
                // First connection + 5 retries
                nock.get('/package.tar.gz').times(6).socketDelay(1000).replyWithFile(200, source);
            },
            expectError: function (e) {
                expect(e.code).to.be('ESOCKETTIMEDOUT');
                expect(fs.readdirSync(tempDir.path)).to.be.empty();
            },
            downloadOpts: {
                timeout: 10,
                maxTimeout: 0,
                minTimeout: 0
            }
        });
    });

    it('handles retries correctly', function () {
        return downloadTest({
            response: function (nock) {
                // First connection + 5 retries
                nock.get('/package.tar.gz').times(5).delayConnection(1000).replyWithFile(200, source);
                // Success last time
                nock.get('/package.tar.gz').replyWithFile(200, source);
            },
            expect: function () {
                expect(fs.existsSync(destination)).to.be(true);
                expect(fs.readdirSync(tempDir.path)).to.have.length(1);
            },
            downloadOpts: {
                timeout: 10,
                maxTimeout: 0,
                minTimeout: 0
            }
        });
    });

    it('fails on incorrect Content-Length match', function () {
        return downloadTest({
            response: function (nock) {
                // First connection + 5 retries
                nock.get('/package.tar.gz').replyWithFile(200, source, { 'Content-Length': 5000 });
            },
            expectError: function (e) {
                expect(e.code).to.be('EINCOMPLETE');
                expect(e.message).to.be('Transfer closed with 4636 bytes remaining to read');
            },
            downloadOpts: {
                timeout: 10,
                maxTimeout: 0,
                minTimeout: 0
            }
        });
    });

    describe('gzipped files', function () {

        function testGzip(sourceFilename) {
            var sourceFile = path.resolve(__dirname, '../assets/' + sourceFilename);
            var destinationPath = tempDir.getPath(sourceFilename);

            return downloadTest({
                response: function (nock) {
                    nock
                    .get('/' + sourceFilename)
                    .replyWithFile(200, sourceFile, {
                        'Content-Encoding' : 'gzip'
                    });
                },
                expect: function () {
                    expect(fs.readFileSync(destinationPath, 'ascii'))
                    .to.be('Hello World!\n');
                },
                sourceUrl: 'http://bower.io/' + sourceFilename,
                destinationPath: destinationPath
            });
        }

        it('correctly decodes gzipped files without gz extension', function () {
            return testGzip('test-gz.txt');
        });

        it('correctly decodes gzipped files with gz extension', function () {
            return testGzip('test-gz.txt.gz');
        });
    });
});
