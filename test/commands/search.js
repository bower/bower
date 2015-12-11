var Q = require('q');
var expect = require('expect.js');
var helpers = require('../helpers');

var search = helpers.command('search');

describe('bower search', function () {

    it('correctly reads arguments', function() {
        expect(search.readOptions(['jquery']))
        .to.eql(['jquery']);
    });

    it('searches for single repository', function () {
        return Q.Promise(function(resolve) {
            var search = helpers.command('search', {
                'bower-registry-client': function() {
                    return {
                        search: resolve
                    };
                }
            });

            helpers.run(search, ['jquery'], {});
        }).then(function(query) {
            expect(query).to.be('jquery');
        });
    });

    it('lists all repositories when no query given in non-interactive mode', function () {
        var nonInteractiveConfig = { interactive: false };

        return Q.Promise(function(resolve) {
            var search = helpers.command('search', {
                'bower-registry-client': function() {
                    return {
                        list: resolve
                    };
                }
            });

            helpers.run(search, [null, nonInteractiveConfig]);
        });
    });

    it('lists all repositories when no query given and config.json is enabled in interactive mode', function () {
        var interactiveConfig = { interactive: true, json: true };

        var search = helpers.command('search', {
            'bower-registry-client': function() {
                return {
                    list: function (cb) { return cb(null, 'foobar'); }
                };
            }
        });

        return helpers.run(search, [null, interactiveConfig])
        .spread(function(result) {
            expect(result).to.be('foobar');
        });
    });

    it('does not list any repositories in interactive mode if no query given and config.json is disabled', function () {
        var interactiveConfig = { interactive: true };

        var search = helpers.command('search', {
            'bower-registry-client': function() {
                return {
                    list: function() { throw 'list called'; },
                    search: function() { throw 'search called'; }
                };
            }
        });

        return helpers.run(search, [null, interactiveConfig])
        .then(function(commandResult) {
            expect().fail('should fail');
        })
        .catch(function(e) {
            expect(e.code).to.be('EREADOPTIONS');
        });
    });
});
