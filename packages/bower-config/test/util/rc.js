var expect = require('expect.js');
var helpers = require('../helpers');

describe('rc', function() {
    var tempDir = new helpers.TempDir();
    var tempDirBowerrc = new helpers.TempDir();

    var rc = require('../../lib/util/rc');

    tempDir.prepare({
        '.bowerrc': {
            key: 'value'
        },
        'child/.bowerrc': {
            key2: 'value2'
        },
        'child2/.bowerrc': {
            key: 'valueShouldBeOverwriteParent'
        },
        'child3/bower.json': {
            name: 'without-bowerrc'
        },
    });

    tempDirBowerrc.prepare({
        '.bowerrc/foo': {
            key: 'bar'
        }
    
    });

    it('correctly reads .bowerrc files', function() {
        var config = rc('bower', tempDir.path);

        expect(config.key).to.eql('value');
        expect(config.key2).to.eql(undefined);
    });

    it('correctly reads .bowerrc files from child', function() {
        var config = rc('bower', tempDir.path + '/child/');

        expect(config.key).to.eql('value');
        expect(config.key2).to.eql('value2');
    });

    it('correctly reads .bowerrc files from child2', function() {
        var config = rc('bower', tempDir.path + '/child2/');

        expect(config.key).to.eql('valueShouldBeOverwriteParent');
        expect(config.key2).to.eql(undefined);
    });

    it('correctly reads .bowerrc files from child3', function() {
        var config = rc('bower', tempDir.path + '/child3/');

        expect(config.key).to.eql('value');
        expect(config.key2).to.eql(undefined);
    });

    it('throws an easy to understand error if .bowerrc is a dir', function() {
        // Gotta wrap this to catch the error
        var config = function () {
            rc('bower', tempDirBowerrc.path);
        };

        expect(config).to.throwError(/should not be a directory/);
    });
});
