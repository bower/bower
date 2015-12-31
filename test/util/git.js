var expect = require('expect.js');
var hasGit = require('../../lib/util/git');

describe('Git installation check', function () {
    it('Git should be installed', function (done) {
         expect(hasGit()).to.be(true);
         done();
    });
});
