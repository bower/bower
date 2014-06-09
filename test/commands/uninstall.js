var path = require('path');
var expect = require('expect.js');
var fs = require('fs');

var helpers = require('../helpers');
var bower = helpers.require('lib/index');

describe('bower uninstall', function () {

    var tempDir = helpers.createTmpDir({
        'bower.json': {
            name: 'hello-world',
            dependencies: {
                'underscore': '*'
            }
        }
    });

    var bowerJsonPath = path.join(tempDir, 'bower.json');

    function bowerJson() {
        return JSON.parse(fs.readFileSync(bowerJsonPath));
    }

    var config = {
        cwd: tempDir,
        interactive: true
    };

    it('does not remove anything from dependencies by default', function () {
        var logger = bower.commands.uninstall(['underscore'], undefined, config);

        return helpers.expectEvent(logger, 'end')
        .then(function () {
            expect(bowerJson().dependencies).to.eql({ 'underscore': '*' });
        });
    });

    it('removes dependency from bower.json if --save flag is used', function () {
        var logger = bower.commands.uninstall(['underscore'], {save: true}, config);

        return helpers.expectEvent(logger, 'end')
        .then(function () {
            expect(bowerJson().dependencies).to.eql({});
        });
    });

});
