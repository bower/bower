var expect = require('expect.js');
var helpers = require('../helpers');
var login = helpers.command('login');

describe("bower github login", function() {
    it("resolves when token option is passed", function(){
        return helpers.run(login, [{token: "tom"}]);
    });

    it("parses options correctly", function(){
        return expect(login.readOptions(["-t", "foo"])).to.eql([{token: 'foo'}]);
    });
});
