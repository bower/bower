var assert = require('assert');
var path = require('path');

describe('NPM Config on package.json', function() {
    beforeEach(function() {
        delete process.env.npm_package_config_bower_directory;
        delete process.env.npm_package_config_bower_colors;
        delete process.env.npm_package_config_bower_resolvers;
    });

    it('defaults registry entries to default registry', function() {
        var config = require('../lib/Config').read(null, {});

        assert.deepEqual(config.registry, {
            default: 'https://registry.bower.io',
            search: ['https://registry.bower.io'],
            register: 'https://registry.bower.io',
            publish: 'https://registry.bower.io'
        });
    });

    it('can change default registry', function() {
        var config = require('../lib/Config').read(null, {
            registry: 'https://foobar'
        });

        assert.deepEqual(config.registry, {
            default: 'https://foobar',
            search: ['https://foobar'],
            register: 'https://foobar',
            publish: 'https://foobar'
        });
    });

    it('can override single entries in registry configuration', function() {
        var config = require('../lib/Config').read(null, {
            registry: { search: 'https://foobar' }
        });

        assert.deepEqual(config.registry, {
            default: 'https://registry.bower.io',
            search: ['https://foobar'],
            register: 'https://registry.bower.io',
            publish: 'https://registry.bower.io'
        });
    });

    it('can override single entries in registry configuration and defaults', function() {
        var config = require('../lib/Config').read(null, {
            registry: { default: 'https://fizfuz', search: 'https://foobar' }
        });

        assert.deepEqual(config.registry, {
            default: 'https://fizfuz',
            search: ['https://foobar'],
            register: 'https://fizfuz',
            publish: 'https://fizfuz'
        });
    });

    it('allows for not providing cwd', function() {
        var config = require('../lib/Config').read();

        config.tmp = '/foo/bar';
        config.userAgent = 'firefox';
        delete config.storage;

        assert.deepEqual(config, {
            directory: 'bower_components',
            registry: {
                default: 'https://registry.bower.io',
                search: ['https://registry.bower.io'],
                register: 'https://registry.bower.io',
                publish: 'https://registry.bower.io'
            },
            shorthandResolver: 'https://github.com/{{owner}}/{{package}}.git',
            tmp: '/foo/bar',
            timeout: 30000,
            ca: {
                search: []
            },
            strictSsl: true,
            userAgent: 'firefox',
            color: true
        });
    });

    function assertCAContents(caData, name) {
        var r = /-----BEGIN CERTIFICATE-----[a-zA-Z0-9+\/=\n\r]+-----END CERTIFICATE-----/;

        assert(caData, name + ' should be set');
        assert(Array.isArray(caData), name + ' should be an array');
        assert.equal(2, caData.length);
        caData.forEach(function(c, i) {
            assert(
                c.match(r),
                name +
                    '[' +
                    i +
                    '] should contain a certificate. Given: ' +
                    JSON.stringify(c)
            );
        });
    }

    describe('Setting process.env.npm_package_config', function() {
        process.env.npm_package_config_bower_directory = 'npm-path';
        process.env.npm_package_config_bower_colors = 'false';
        process.env.npm_package_config_bower_resolvers = '[foo,bar,baz]';

        var config = require('../lib/Config').read();

        it('should return "npm-path" for "bower_directory"', function() {
            assert.equal('npm-path', config.directory);
        });
        it('should return "false" for "bower_colors"', function() {
            assert.equal('false', config.colors);
        });
        it('should expand array "false" for "bower_resolvers"', function() {
            assert.deepEqual(['foo', 'bar', 'baz'], config.resolvers);
        });
    });

    describe('Specifying custom CA', function() {
        it('should read the CA file', function() {
            var config = require('../lib/Config').read(
                path.resolve('test/assets/custom-ca')
            );

            ['register', 'publish', 'default'].forEach(function(p) {
                assertCAContents(config.ca[p], 'config.ca.' + p);
            });

            assert(
                Array.isArray(config.ca.search),
                'ca property search should be an array'
            );

            config.ca.search.forEach(function(c, i) {
                assertCAContents(c, 'config.ca.search[' + i + ']');
            });
        });

        it('should backward-support certificate inside .bowerrc', function() {
            var config = require('../lib/Config').read(
                path.resolve('test/assets/custom-ca-embed')
            );

            ['register', 'publish', 'default'].forEach(function(p) {
                assertCAContents(config.ca[p], 'config.ca.' + p);
            });

            assert(
                Array.isArray(config.ca.search),
                'ca property search should be an array'
            );
            config.ca.search.forEach(function(c, i) {
                assertCAContents(c, 'config.ca.search[' + i + ']');
            });
        });
    });

    describe('setting ENV variables', function() {
        beforeEach(function() {
            delete process.env.no_proxy;
            delete process.env.http_proxy;
            delete process.env.https_proxy;
            delete process.env.NO_PROXY;
            delete process.env.HTTP_PROXY;
            delete process.env.HTTPS_PROXY;
        });

        it('sets env variables', function() {
            require('../lib/Config').read('test/assets/env-variables');

            assert.equal(process.env.HTTP_PROXY, 'http://HTTP_PROXY');
            assert.equal(process.env.HTTPS_PROXY, 'http://HTTPS_PROXY');
            assert.equal(process.env.NO_PROXY, 'google.com');

            assert.equal(process.env.http_proxy, undefined);
            assert.equal(process.env.https_proxy, undefined);
            assert.equal(process.env.no_proxy, undefined);
        });

        it('restores env variables', function() {
            process.env.HTTP_PROXY = 'a';
            process.env.HTTPS_PROXY = 'b';
            process.env.NO_PROXY = 'c';
            process.env.http_proxy = 'd';
            process.env.https_proxy = 'e';
            process.env.no_proxy = 'f';

            var config = require('../lib/Config')
                .create('test/assets/env-variables')
                .load();
            config.restore();

            assert.equal(process.env.HTTP_PROXY, 'a');
            assert.equal(process.env.HTTPS_PROXY, 'b');
            assert.equal(process.env.NO_PROXY, 'c');

            assert.equal(process.env.http_proxy, 'd');
            assert.equal(process.env.https_proxy, 'e');
            assert.equal(process.env.no_proxy, 'f');
        });

        it('restores env variables if they are undefined', function() {
            var config = require('../lib/Config')
                .create('test/assets/env-variables')
                .load();
            config.restore();

            assert.equal(process.env.HTTP_PROXY, undefined);
            assert.equal(process.env.HTTPS_PROXY, undefined);
            assert.equal(process.env.NO_PROXY, undefined);

            assert.equal(process.env.http_proxy, undefined);
            assert.equal(process.env.https_proxy, undefined);
            assert.equal(process.env.no_proxy, undefined);
        });

        it('allows for overriding options', function() {
            require('../lib/Config').read('test/assets/env-variables', {
                httpsProxy: 'http://other-proxy.local'
            });

            assert.equal(process.env.HTTP_PROXY, 'http://HTTP_PROXY');
            assert.equal(process.env.HTTPS_PROXY, 'http://other-proxy.local');
        });
    });
});

describe('Allow ${ENV} variables in .bowerrc', function() {
    it('sets values from process.env', function() {
        process.env._BOWERRC_MY_PACKAGES = 'a';
        process.env._BOWERRC_MY_TMP = '/tmp/b';
        process.env._BOWERRC_MY_USER = 'username';
        process.env._BOWERRC_MY_PASS = 'password';

        var config = require('../lib/Config').read(
            'test/assets/env-variables-values'
        );
        assert.equal('a', config.storage.packages);
        assert.equal('/tmp/b', config.tmp);
        assert.equal('username:password', config.storage.registry.search[0]);
        assert.equal('${_myshellvar}', config.scripts.postinstall);
    });
});

describe('untildify paths in .bowerrc', function() {
    it('resolve ~/ in .bowerrc', function() {
        var config = require('../lib/Config').read(
            'test/assets/env-variables-values'
        );
        var untildify = require('untildify');

        assert.equal(
            untildify('~/.bower-test/registry'),
            config.storage.registry.register
        );
    });
});

require('./util/index');
