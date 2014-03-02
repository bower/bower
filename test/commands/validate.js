var expect = require('expect.js');
var validate = require('../../lib/commands/validate');
var Logger = require('bower-logger');

describe('bower-validate', function () {

    var logger;

    afterEach(function () {
        logger.removeAllListeners();
    });

    it('should emit error if bower.json file does not exist', function (done) {

        logger = validate();
        logger.on('error', function (log) {
            expect(log).to.be.an('object');
            expect(log.code).to.be('MODULE_NOT_FOUND');
            done();
        });

    });

    it('should return success message when using a valid bower.json', function (done) {

        var filename = './test/assets/bower-json-samples/bower.json';

        logger = validate(filename);
        logger.on('end', function (log) {
            expect(log).to.be(validate._successMessage(filename));
            done();
        });

    });

    it('should emit error when bower.json does not have a valid name', function (done) {

        var filename = './test/assets/bower-json-samples/no_name.json';

        logger = validate(filename);
        logger.on('error', function (log) {
            expect(log).to.be.an('object');
            expect(log.code).to.be('NO_NAME');
            expect(log.message).to.be(validate._nameErrorMessage(filename));
            done();
        });

    });

    it('should emit error when bower.json does not have a valid version', function (done) {

        var filename = './test/assets/bower-json-samples/no_version.json';

        logger = validate(filename);
        logger.on('error', function (log) {
            expect(log).to.be.an('object');
            expect(log.code).to.be('SEMVER');
            expect(log.message).to.be(validate._versionErrorMessage(filename));
            done();
        });

    });

    it('should emit error when the version number is not valid', function (done) {

        var filename = './test/assets/bower-json-samples/invalid_version.json';

        logger = validate(filename);
        logger.on('error', function (log) {
            expect(log).to.be.an('object');
            expect(log.code).to.be('SEMVER');
            expect(log.message).to.be(validate._versionErrorMessage(filename));
            done();
        });

    });

    it('should find and validate bower.json file when using a folder path', function (done) {

        var filename = './test/assets/bower-json-samples/';

        logger = validate(filename);
        logger.on('end', function (log) {
            expect(log).to.be(validate._successMessage(filename));
            done();
        });

    });

    it('should find and emit error for a unvalid bower.json file when using a folder path', function (done) {

        var filename = './test/assets/bower-json-samples/test_path/';

        logger = validate(filename);
        logger.on('error', function (log) {
            expect(log).to.be.an('object');
            expect(log.code).to.be('NO_NAME');
            expect(log.message).to.be(validate._nameErrorMessage(filename));
            done();
        });

    });

});
