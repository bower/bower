var path = require('path');
var expect = require('expect.js');
var fs = require('fs');

var helpers = require('../helpers');
var bower = helpers.require('lib/index');

describe('bower shrinkwrap', function () {

    var tempDir = new helpers.TempDir();
    var bowerJsonPath = path.join(tempDir.path, 'bower.json');

    var config = {
        cwd: tempDir.path,
        interactive: true
    };

});
