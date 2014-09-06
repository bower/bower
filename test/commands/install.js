var path = require('path');
var expect = require('expect.js');
var fs = require('fs');

var helpers = require('../helpers');
var commands = helpers.require('lib/index').commands;

describe('bower install', function () {

    var tempDir = new helpers.TempDir();


    function bowerJson() {
        var bowerJsonPath = path.join(
            tempDir.path, 'bower_components', 'underscore', 'bower.json'
        );

        return JSON.parse(fs.readFileSync(bowerJsonPath));
    }

    var config = {
        cwd: tempDir.path,
        interactive: true
    };

    var install = function(options) {
        options = options || {};

        var logger = commands.install(
            options.packages, options.options, config
        );

        return helpers.expectEvent(logger, 'end');
    };

    it.skip('installs a package', function () {
        tempDir.prepare();

        this.timeout(10000);
        var logger = commands.install(['underscore'], undefined, config);

        return helpers.expectEvent(logger, 'end')
        .then(function () {
            expect(bowerJson()).to.have.key('name');
        });
    });

    it.skip('installs package with --save flag', function () {
        tempDir.prepare();

        var logger = commands.install(['underscore'], {save: true}, config);

        return helpers.expectEvent(logger, 'end')
        .then(function () {
            expect(bowerJson()).to.have.key('name');
        });
    });

    it('reads .bowerrc from cwd', function () {
        var package = new helpers.TempDir({
            'bower.json': {
                name: 'package'
            },
            foo: 'bar'
        }).prepare();

        tempDir.prepare({
            '.bowerrc': { directory: 'assets' },
            'bower.json': {
                name: 'test',
                dependencies: {
                    package: package.path
                }
            }
        });

        return install().then(function() {
            expect(tempDir.read('assets/package/foo')).to.be('bar');
        });
    });

});
