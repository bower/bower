var path = require('path');
var bower = require('../lib/index.js');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var expect = require('expect.js');
var Q = require('Q');

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
        .then(function (prompt, callback) {
            callback({
                name: 'test-name',
                version: 'test-version',
                description: 'test-description',
                moduleType: 'test-moduleType',
                keywords: ['test-keyword'],
                authors: ['test-answer'],
                license: ['test-license'],
                homepage: ['test-homepage'],
                private: true
            });
        })
        .then(function () {
            return expectEvent(logger, 'end');
        });
    });
});
