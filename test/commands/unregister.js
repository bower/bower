var expect = require('expect.js');
var helpers = require('../helpers');
var unregister = helpers.command('unregister');

describe('unregister cli', function() {
    it('parses options', function() {
        var unregisterArgs = ['somename'];

        return expect(unregister.readOptions(unregisterArgs)).to.eql(['somename']);
    });

});
