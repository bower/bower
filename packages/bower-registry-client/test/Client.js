var RegistryClient = require('../Client'),
    expect = require('chai').expect;

describe('RegistryClient', function () {

    beforeEach(function () {
        this.uri = 'https://bower.herokuapp.com';
        this.timeoutVal = 5000;
        this.client = new RegistryClient();
        this.conf = {
            search: [this.uri],
            register: this.uri,
            publish: this.uri
        };
    });

    describe('Constructor', function () {

        describe('instantiating a client without custom options', function () {

            it('should provide an instance of RegistryClient', function () {
                expect(this.client instanceof RegistryClient).to.be.ok;
            });

            it('should set properties correctly', function () {
                expect(this.client).to.have.ownProperty('_config');
                expect(this.client).to.have.ownProperty('_cache');
                expect(this.client).to.have.ownProperty('_lookupCache');
                expect(this.client).to.have.ownProperty('_searchCache');
                expect(this.client).to.have.ownProperty('_listCache');
            });

            it('should set default registry config', function () {
                expect(this.client._config.registry).to.deep.equal(this.conf);
            });

            it('should set default search config', function () {
                expect(this.client._config.registry.search[0]).to.equal(this.uri);
            });

            it('should set default register config', function () {
                expect(this.client._config.registry.register).to.equal(this.uri);
            });

            it('should set default publish config', function () {
                expect(this.client._config.registry.publish).to.equal(this.uri);
            });

            it('should set default cache path config', function () {
                expect(typeof this.client._config.cache === 'string').to.be.ok;
            });

            it('should set default timeout config', function () {
                expect(this.client._config.timeout).to.equal(this.timeoutVal);
            });

            it('should set default strictSsl config', function () {
                expect(this.client._config.strictSsl).to.be.ok;
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

});
