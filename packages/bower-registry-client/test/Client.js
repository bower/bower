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

        it('should have a resetCache prototype method', function () {
            expect(RegistryClient.prototype).to.have.ownProperty('resetCache');
        });

        it('should have a clearRuntimeCache static method', function () {
            expect(RegistryClient).to.have.ownProperty('clearRuntimeCache');
        });

    });


    //
    // lookup
    //
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

        it('should return an error and no result', function () {
            this.registry.lookup('', function (err, entry) {
                expect(err).to.not.be.null;
                expect(entry).to.be.undefined;
            });
        });

    });


    //
    // register
    //
    describe('calling the register instance method with argument', function () {

        beforeEach(function () {
            nock('https://bower.herokuapp.com:443')
              .post('/packages', 'name=test-ba&url=git%3A%2F%2Fgithub.com%2Ftest-ba%2Ftest-ba.git')
              .reply(201);

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

    describe('calling the register instance method without arguments', function () {
        it('should return an error and no result', function () {
            this.registry.register('', '', function (err, entry) {
                expect(err).to.not.be.null;
                expect(entry).to.be.undefined;
            });
        });
    });


    //
    // search
    //
    describe('calling the search instance method with argument', function () {

        beforeEach(function () {
            nock('https://bower.herokuapp.com:443')
              .get('/packages/search/jquery')
              .replyWithFile(200, __dirname + '/fixtures/search.json');

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
        it('should return an error and no results', function () {
            this.registry.search('', function (err, results) {
                expect(err).to.not.be.null;
                expect(results).to.be.undefined;
            });
        });
    });


    //
    // clearCache
    //
    describe('called the clearCache instance method with argument', function () {

        beforeEach(function () {
            this.pkg = 'jquery';
        });

        it('should not return an error', function () {
            this.registry.clearCache(this.pkg, function (err) {
                expect(err).to.be.null;
            });
        });
    });

    describe('called the clearCache instance method without argument', function () {

        it('should not return any errors and remove all cache items', function () {
            this.registry.clearCache(function (err) {
                expect(err).to.be.null;
            });
        });
    });

});
