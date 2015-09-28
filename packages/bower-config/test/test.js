var assert = require('assert');
var path = require('path');

describe('NPM Config on package.json', function () {
    beforeEach(function () {
        delete process.env.npm_package_config_bower_directory;
        delete process.env.npm_package_config_bower_colors;
    });

    it('allows for not providing cwd', function () {
        var config = require('../lib/Config').read();

        console.log(JSON.stringify(config, undefined, '  '));

        config.tmp = '/foo/bar';
        config.userAgent = 'firefox';
        delete config.storage;

        assert.deepEqual(config, {
          'directory': 'bower_components',
          'registry': {
            'default': 'https://bower.herokuapp.com',
            'search': [
              'https://bower.herokuapp.com'
            ],
            'register': 'https://bower.herokuapp.com',
            'publish': 'https://bower.herokuapp.com'
          },
          'shorthandResolver': 'git://github.com/{{owner}}/{{package}}.git',
          'tmp': '/foo/bar',
          'timeout': 30000,
          'ca': {
            'search': []
          },
          'strictSsl': true,
          'userAgent': 'firefox',
          'color': true
        });
    });

    function assertCAContents(caData, name) {
        var r = /-----BEGIN CERTIFICATE-----[a-zA-Z0-9+\/=\n\r]+-----END CERTIFICATE-----/;

        assert(caData, name + ' should be set');
        assert(Array.isArray(caData), name + ' should be an array');
        assert.equal(2, caData.length);
        caData.forEach(function(c, i) {
            assert(c.match(r),
                   name + '[' + i + '] should contain a certificate. Given: ' + JSON.stringify(c));
        });
    }

    describe('Setting process.env.npm_package_config', function () {
        process.env.npm_package_config_bower_directory = 'npm-path';
        process.env.npm_package_config_bower_colors = false;

        var config = require('../lib/Config').read();

        it('should return "npm-path" for "bower_directory"', function () {
            assert.equal('npm-path', config.directory);
        });
        it('should return "false" for "bower_colors"', function () {
            assert.equal('false', config.colors);
        });
    });

    describe('Specifying custom CA', function() {

        it('should read the CA file', function() {
            var config = require('../lib/Config')
                .read(path.resolve('test/assets/custom-ca'));

            ['register', 'publish'].forEach(function (p) {
                assertCAContents(config.ca[p], 'config.ca.' + p);
            });

            assert(Array.isArray(config.ca.search),
                    'ca property search should be an array');

            config.ca.search.forEach(function(c, i) {
                assertCAContents(c, 'config.ca.search[' + i + ']');
            });
        });

        it('should backward-support certificate inside .bowerrc', function() {
            var config = require('../lib/Config')
                .read(path.resolve('test/assets/custom-ca-embed'));

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

    describe('setting ENV variables', function () {
        beforeEach(function () {
            delete process.env.no_proxy;
            delete process.env.http_proxy;
            delete process.env.https_proxy;
            delete process.env.NO_PROXY;
            delete process.env.HTTP_PROXY;
            delete process.env.HTTPS_PROXY;
        });

        it('sets env variables', function () {
            require('../lib/Config').read('test/assets/env-variables');

            assert.equal(process.env.HTTP_PROXY, 'http://HTTP_PROXY');
            assert.equal(process.env.HTTPS_PROXY, 'http://HTTPS_PROXY');
            assert.equal(process.env.NO_PROXY, 'google.com');

            assert.equal(process.env.http_proxy, undefined);
            assert.equal(process.env.https_proxy, undefined);
            assert.equal(process.env.no_proxy, undefined);
        });

        it('restores env variables', function () {
            process.env.HTTP_PROXY = 'a';
            process.env.HTTPS_PROXY = 'b';
            process.env.NO_PROXY = 'c';
            process.env.http_proxy = 'd';
            process.env.https_proxy = 'e';
            process.env.no_proxy = 'f';

            var config = require('../lib/Config').create('test/assets/env-variables').load();
            config.restore();

            assert.equal(process.env.HTTP_PROXY, 'a');
            assert.equal(process.env.HTTPS_PROXY, 'b');
            assert.equal(process.env.NO_PROXY, 'c');

            assert.equal(process.env.http_proxy, 'd');
            assert.equal(process.env.https_proxy, 'e');
            assert.equal(process.env.no_proxy, 'f');
        });

        it('allows for overriding options', function () {
            require('../lib/Config').read('test/assets/env-variables', {
                httpsProxy: 'http://other-proxy.local'
            });

            assert.equal(process.env.HTTP_PROXY, 'http://HTTP_PROXY');
            assert.equal(process.env.HTTPS_PROXY, 'http://other-proxy.local');
        });
    });

});

require('./util/index');
