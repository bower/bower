var assert = require('assert');
var path = require('path');

describe('NPM Config on package.json', function () {
    describe('Setting process.env.npm_package_config', function () {
        /*jshint camelcase:false*/
        process.env.npm_package_config_bower_directory = 'npm-path';
        process.env.npm_package_config_bower_colors = false;

        var config = require('../lib/Config').create().load()._config;

        it('should return "npm-path" for "bower_directory"', function () {
            assert.equal('npm-path', config.directory);
        });
        it('should return "false" for "bower_colors"', function () {
            assert.equal('false', config.colors);
        });
    });

    describe('Specifying custom CA', function() {
        var config = require('../lib/Config')
            .read(path.resolve('test/assets/custom-ca'));

        it('should read the CA file', function() {
            function assertCAContents(caData, name) {
                var r = /-----BEGIN CERTIFICATE-----[a-zA-Z0-9+\/=\n\r]+-----END CERTIFICATE-----/;

                assert(caData, name + ' should be set');
                assert(Array.isArray(caData), name + ' should be an array');
                assert.equal(2, caData.length);
                caData.forEach(function(c, i) {
                    assert(c.match(r),
                            name + '[' + i + '] should contain a certificate');
                });
            }

            ['register', 'publish'].forEach(function (p) {
                assertCAContents(config.ca[p], 'config.ca.' + p);
            });

            assert(Array.isArray(config.ca.search),
                    'ca property search should be an array');
            config.ca.search.forEach(function(c, i) {
                assertCAContents(c, 'config.ca.search[' + i + ']');
            });
        });
    });
});

require('./util/index');
