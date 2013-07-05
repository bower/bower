var RegistryClient = require('../Client'),
    expect = require('chai').expect,
    nock = require('nock');


describe('RegistryClient', function () {

    beforeEach(function () {
        this.uri = 'https://bower.herokuapp.com';
        this.timeoutVal = 5000;
        this.registry = new RegistryClient({
            strictSsl: false
        });
        this.conf = {
            search: [this.uri],
            register: this.uri,
            publish: this.uri
        };
    });

    describe('Constructor', function () {

        describe('instantiating a client without custom options', function () {

            it('should provide an instance of RegistryClient', function () {
                expect(this.registry instanceof RegistryClient).to.be.ok;
            });

            it('should set properties correctly', function () {
                expect(this.registry).to.have.ownProperty('_config');
                expect(this.registry).to.have.ownProperty('_cache');
                expect(this.registry).to.have.ownProperty('_lookupCache');
                expect(this.registry).to.have.ownProperty('_searchCache');
                expect(this.registry).to.have.ownProperty('_listCache');
            });

            it('should set default registry config', function () {
                expect(this.registry._config.registry).to.deep.equal(this.conf);
            });

            it('should set default search config', function () {
                expect(this.registry._config.registry.search[0]).to.equal(this.uri);
            });

            it('should set default register config', function () {
                expect(this.registry._config.registry.register).to.equal(this.uri);
            });

            it('should set default publish config', function () {
                expect(this.registry._config.registry.publish).to.equal(this.uri);
            });

            it('should set default cache path config', function () {
                expect(typeof this.registry._config.cache === 'string').to.be.ok;
            });

            it('should set default timeout config', function () {
                expect(this.registry._config.timeout).to.equal(this.timeoutVal);
            });

            it('should set default strictSsl config', function () {
                expect(this.registry._config.strictSsl).to.be.false;
            });

        });

        it('should have a lookup prototype method', function () {
            expect(RegistryClient.prototype).to.have.ownProperty('lookup');
        });

        it('should have a search prototype method', function () {
            expect(RegistryClient.prototype).to.have.ownProperty('search');
        });

        it('should have a list prototype method', function () {
            expect(RegistryClient.prototype).to.have.ownProperty('list');
        });

        it('should have a register prototype method', function () {
            expect(RegistryClient.prototype).to.have.ownProperty('register');
        });

        it('should have a clearCache prototype method', function () {
            expect(RegistryClient.prototype).to.have.ownProperty('clearCache');
        });

        it('should have a clearRuntimeCache prototype method', function () {
            expect(RegistryClient.prototype).to.have.ownProperty('clearRuntimeCache');
        });

        it('should have a _initCache prototype method', function () {
            expect(RegistryClient.prototype).to.have.ownProperty('_initCache');
        });

    });

    describe('calling the lookup instance method with argument', function () {

        it('should not return an error', function () {
            this.registry.lookup('jquery', function (err) {
                expect(err).to.be.null;
            });
        });

        it('should return entry type', function () {
            this.registry.lookup('jquery', function (err, entry) {
                expect(err).to.be.null;
                expect(entry.type).to.equal('alias');
            });
        });

        it('should return entry url ', function () {
            this.registry.lookup('jquery', function (err, entry) {
                expect(err).to.be.null;
                expect(entry.url).to.equal('git://github.com/components/jquery.git');
            });
        });

    });

    describe('calling the lookup instance method without argument', function () {

        it('should', function () {
            this.registry.lookup('', function (err, entry) {
                expect(err).to.not.be.null;
                expect(entry).to.be.undefined;
            });
        });

    });

    describe('calling the register instance method with argument', function () {

        beforeEach(function () {
            nock('https://bower.herokuapp.com:443')
              .post('/packages', 'name=test-ba&url=git%3A%2F%2Fgithub.com%2Ftest-ba%2Ftest-ba.git')
              .reply(201, '', { 'content-type': 'text/html;charset=utf-8',
              server: 'thin 1.3.1 codename Triple Espresso',
              'x-frame-options': 'sameorigin',
              'x-xss-protection': '1; mode=block',
              'content-length': '0',
              connection: 'keep-alive' });

            this.pkg = 'test-ba';
            this.pkgUrl = 'git://github.com/test-ba/test-ba.git';
        });

        it('should not return an error', function (done) {
            this.registry.register(this.pkg, this.pkgUrl, function (err) {
                expect(err).to.be.null;
                done();
            });
        });

        it('should return entry name', function (done) {
            var self = this;

            this.registry.register(this.pkg, this.pkgUrl, function (err, entry) {
                expect(err).to.be.null;
                expect(entry.name).to.equal(self.pkg);
                done();
            });
        });

        it('should return entry url', function (done) {
            var self = this;

            this.registry.register(this.pkg, this.pkgUrl, function (err, entry) {
                expect(err).to.be.null;
                expect(entry.url).to.equal(self.pkgUrl);
                done();
            });
        });

    });

    //describe('calling the register instance method without argument', function () {});

    describe('calling the search instance method with argument', function () {

        beforeEach(function () {
            this.pkg = 'jquery';
            this.pkgUrl = 'git://github.com/components/jquery.git';
        });

        it('should not return an error', function (done) {
            this.registry.search(this.pkg, function (err) {
                expect(err).to.be.null;
                done();
            });
        });

        it('should return entry name', function (done) {
            var self = this;

            this.registry.search(this.pkg, function (err, results) {
                results.forEach(function (entry) {
                    if (entry.name === self.pkg) {
                        expect(entry.name).to.equal(self.pkg);
                        done();
                    }
                });
            });
        });

        it('should return entry url', function (done) {
            var self = this;

            this.registry.search(this.pkg, function (err, results) {
                results.forEach(function (entry) {
                    if (entry.name === self.pkg) {
                        expect(entry.url).to.equal(self.pkgUrl);
                        done();
                    }
                });
            });
        });

    });

    describe('calling the search instance method without argument', function () {
    });

});
