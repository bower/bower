var path = require('path');
var expect = require('expect.js');
var fs = require('fs');

var helpers = require('../helpers');
var bower = helpers.require('lib/index');

describe('bower install', function () {

    var tempDir = helpers.createTmpDir();
    var bowerJsonPath = path.join(tempDir, 'bower_components', 'underscore', 'bower.json');

    function bowerJson() {
        return JSON.parse(fs.readFileSync(bowerJsonPath));
    }

    var config = {
        cwd: tempDir,
        interactive: true
    };

    it.skip('installs a package', function () {
        this.timeout(10000);
        var logger = bower.commands.install(['underscore'], undefined, config);

        return helpers.expectEvent(logger, 'end')
        .then(function () {
            expect(bowerJson()).to.have.key('name');
        });
    });

    it.skip('installs package with --save flag', function () {
        var logger = bower.commands.install(['underscore'], {save: true}, config);

        return helpers.expectEvent(logger, 'end')
        .then(function () {
            expect(bowerJson()).to.have.key('name');
        });
    });

});
