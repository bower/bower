var Q = require('q');
var expect = require('expect.js');
var helpers = require('../helpers');

describe('bower lookup', function () {

    it('lookups package by name', function () {
        return Q.Promise(function(resolve) {
            var lookup = helpers.command('lookup', {
                'bower-registry-client': function() {
                    return {
                        lookup: resolve
                    };
                }
            });

            helpers.run(lookup, ['jquery'], {});
        }).then(function (query) {
            expect(query).to.be('jquery');
        });
    });

});
