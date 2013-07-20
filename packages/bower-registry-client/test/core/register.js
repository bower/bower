var register = require('../../lib/register'),
    expect = require('expect.js');

describe('register module', function () {
    describe('requiring the register module', function () {
        it('should expose a register method', function () {
            expect(typeof register === 'function').to.be.ok;
        });
    });
});
