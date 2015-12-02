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
        // Set the json config globally as if it were entered on the command line
        var bowerConfig = require('../../lib').config;
        bowerConfig.json = true;

        var interactiveConfig = { interactive: true };

        return Q.Promise(function(resolve) {
            var search = helpers.command('search', {
                'bower-registry-client': function() {
                    return {
                        list: resolve
                    };
                }
            });

            helpers.run(search, [null, interactiveConfig]);
        }).then(function() {
            // Reset the global json config value
            bowerConfig.json = false;
        });
    });

    it('does not list any repositories in interactive mode if no query given and config.json is disabled', function (done) {
        var interactiveConfig = { interactive: true };
        return Q.Promise(function(resolve, reject) {
            var search = helpers.command('search', {
                'bower-registry-client': function() {
                    return {
                        list: reject
                    };
                }
            });

            helpers.run(search, [null, interactiveConfig]).then(function(loggerEndData) {
                var commandResult = loggerEndData[0];
                resolve(commandResult);
            });
        })
        .then(function(commandResult) {
            // No work should have been done, so no value should be returned.
            expect(commandResult).to.be(undefined);
        })
        .catch(function() {
            expect().fail('should not list repositories');
        })
        .done(done);
    });
});
