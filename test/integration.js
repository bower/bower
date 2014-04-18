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
    var tempDir = path.join(__dirname, 'tmp/cwd');
    var bowerJsonPath = path.join(tempDir, 'bower.json');

    function bowerJson() {
        return JSON.parse(fs.readFileSync(bowerJsonPath));
    }


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
            expect(fs.existsSync(bowerJsonPath)).to.be(true);
        });
    });

    it('bower install', function () {
        var logger = bower.commands.install([], undefined, config);

        return expectEvent(logger, 'end');
    });

    it('bower install <package>', function () {
        var logger = bower.commands.install(['underscore'], undefined, config);

        return expectEvent(logger, 'end')
        .then(function () {
            expect(bowerJson()).to.not.have.key('dependencies');
        });
    });

    it('bower install <package> --save', function () {
        var logger = bower.commands.install(['underscore'], {save: true}, config);

        return expectEvent(logger, 'end')
        .then(function () {
            expect(bowerJson()).to.have.key('dependencies');
        });
    });

    it('bower uninstall <package>', function () {
        var logger = bower.commands.uninstall(['underscore'], {save: true}, config);

        return expectEvent(logger, 'end')
        .then(function () {
            expect(bowerJson()).to.have.key('dependencies');
            expect(bowerJson().dependencies).to.eql({});
        });
    });
});
