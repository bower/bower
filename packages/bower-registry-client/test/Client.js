var RegistryClient = require('../Client'),
    expect = require('chai').expect;

describe('RegistryClient', function () {

    beforeEach(function () {
        this.client = new RegistryClient();
    });

    describe('Constructor', function () {

        describe('instantiating a client', function () {

            it('should set properties correctly', function () {
                expect(this.client).to.have.ownProperty('_config');
                expect(this.client).to.have.ownProperty('_cache');
                expect(this.client).to.have.ownProperty('_lookupCache');
                expect(this.client).to.have.ownProperty('_searchCache');
                expect(this.client).to.have.ownProperty('_listCache');
            });

        });

    });

});
