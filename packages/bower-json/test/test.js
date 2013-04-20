var path = require('path');
var expect = require('expect.js');
var bowerJson = require('../lib/bower-json');

describe('.find', function () {
    it('should find the bower.json file', function (done) {
        bowerJson.find(__dirname + '/pkg-bower-json', function (err, file) {
            if (err) return done(err);

            expect(file).to.equal(path.resolve(__dirname + '/pkg-bower-json/bower.json'));
            done();
        });
    });

    it('should fallback to the component.json file', function (done) {
        bowerJson.find(__dirname + '/pkg-component-json', function (err, file) {
            if (err) return done(err);

            expect(file).to.equal(path.resolve(__dirname + '/pkg-component-json/component.json'));
            done();
        });
    });

    it('should error if no component.json / bower.json is found', function (done) {
        bowerJson.find(__dirname, function (err) {
            expect(err).to.be.an(Error);
            expect(err.code).to.equal('ENOENT');
            done();
        });
    });
});

describe('.read', function () {
    it('should give error if file does not exists', function (done) {
        bowerJson.read(__dirname + '/willneverexist', function (err) {
            expect(err).to.be.an(Error);
            expect(err.code).to.equal('ENOENT');
            done();
        });
    });

    it('should give error if when reading an invalid json', function (done) {
        bowerJson.read(__dirname + '/pkg-bower-json-invalid/bower.json', function (err) {
            expect(err).to.be.an(Error);
            expect(err.code).to.equal('ESYNTAX');
            done();
        });
    });

    it('should read the file and give an object', function (done) {
        bowerJson.read(__dirname + '/pkg-bower-json/bower.json', function (err, json) {
            if (err) return done(err);

            expect(json).to.be.an('object');
            expect(json.name).to.equal('some-pkg');
            expect(json.version).to.equal('0.0.0');
            done();
        });
    });

    it.skip('should validate the returned object');
});

describe('.parse', function () {
    it('should return the same object', function () {
        var json = {
            name: 'foo',
            version: '0.0.0'
        };

        expect(bowerJson.parse(json)).to.equal(json);
    });

    it.skip('should validate the passed object');
});