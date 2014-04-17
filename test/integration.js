var path = require('path');
var bower = require('../lib/index.js');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var fs = require('graceful-fs');
var expect = require('expect.js');
var Q = require('q');

function expectEvent(emitter, eventName) {
    var deferred = Q.defer();
    emitter.once(eventName, function () {
        deferred.resolve(arguments);
    });
    return deferred.promise;
}

describe('integration tests', function () {
    var tempDir = path.join(__dirname, '../assets/temp-integration');

    var config = {
        cwd: tempDir,
        interactive: true
    };

    before(function (next) {
        mkdirp(tempDir, next);
    });

    after(function (next) {
        rimraf(tempDir,  next);
    });

    it('bower init', function () {
        var logger = bower.commands.init(config);

        return expectEvent(logger, 'prompt')
        .spread(function (prompt, answer) {
            answer({
                name: 'test-name',
                version: 'test-version',
                description: 'test-description',
                moduleType: 'test-moduleType',
                keywords: 'test-keyword',
                authors: 'test-author',
                license: 'test-license',
                homepage: 'test-homepage',
                private: true
            });

            return expectEvent(logger, 'prompt');
        })
        .spread(function (prompt, answer) {
            answer({
                prompt: true
            });

            return expectEvent(logger, 'end');
        })
        .then(function () {
            var bowerJsonPath = path.join(tempDir, 'bower.json');

            expect(fs.existsSync(bowerJsonPath)).to.be(true);
        });
    });
});
