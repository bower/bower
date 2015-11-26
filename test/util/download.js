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
            nock('https://bower.io', opts.nockOpts)
                .get('/package.tar.gz'));

        download('https://bower.io/package.tar.gz', destination, opts.downloadOpts)
            .then(function (result) {
                if (opts.expect) {
                    opts.expect(result);
                    deferred.resolve();
                } else {
                    deferred.reject(result);
                }    
            }, function (error) {
                if (opts.expectError) {
                    opts.expectError();
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
                nock.replyWithFile(200, source);
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
                nock.replyWithFile(200, source);
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
                nock.reply(404);
            },
            expectError: function () {
                expect(fs.readdirSync(tempDir.path)).to.be.empty();
            }
        });
    });

    it('handle network error', function () {
        return downloadTest({
            response: function (nock) {
                nock.replyWithError('network error');
            },
            expectError: function () {
                expect(fs.readdirSync(tempDir.path)).to.be.empty();
            }
        });
    });

});
