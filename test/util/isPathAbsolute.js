var expect = require('expect.js');
var isPathAbsolute = require('../../lib/util/isPathAbsolute');

describe('isPathAbsolute', function () {

    it('returns true when a path begins with /', function() {
        expect(isPathAbsolute('/tmp/foo')).to.be.ok();
    });

    it('returns false when a path does not begin with /', function() {
        expect(isPathAbsolute('./tmp/foo')).to.not.be.ok();
    });

});
