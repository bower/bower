var path = require('path');
var Q = require('q');
var fs = require('fs');
var expect = require('expect.js');
var helpers = require('../helpers');
var createLink = require('../../lib/util/createLink');

describe('createLink', function () {

    var srcDir = new helpers.TempDir({
        someFile: 'Hello World',
        someDirectory: {
            otherFile: 'Hello World'
        }
    });

    var dstDir = new helpers.TempDir();

    beforeEach(function () {
        srcDir.prepare();
        dstDir.prepare();
    });

    it('creates a symlink to a file', function () {

        var src = path.join(srcDir.path, 'someFile'),
            dst = path.join(dstDir.path, 'someFile');

        return createLink(src, dst)
        .then(function () {
            return Q.nfcall(fs.readlink, dst)
            .then(function (linkString) {
                expect(linkString).to.be.equal(src);
            });
        });
    });

    it('throws an error when destination already exists', function () {

        var src = path.join(srcDir.path, 'someFile'),
            dst = path.join(dstDir.path);

        var deferred = Q.defer();

        createLink(src, dst)
        .catch(function (err) {
            expect(err.code).to.be.equal('EEXIST');
            deferred.resolve();
        })
        .then(function () {
            deferred.reject();
        });

        return deferred.promise;
    });

});
