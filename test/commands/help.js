var expect = require('expect.js');
var helpers = require('../helpers');

describe('bower help', function () {

    var tempDir = new helpers.TempDir();

    it('shows general help', function () {
        tempDir.prepare();

        return helpers.run('help').then(function(result) {
            expect(result.usage[0]).to.be.a('string');
            expect(result.commands).to.be.a('object');
            expect(result.options).to.be.a('object');
        });
    });

    var commands = [
        'home', 'info', 'init', 'install',
        'link', 'list', 'lookup', 'prune', 'register',
        'search', 'update', 'uninstall', 'version',
        'cache list', 'cache clean'
    ];

    commands.forEach(function(command) {
        it('shows help for ' + command + ' command', function() {
            return helpers.run('help', [command]).then(function(result) {
                expect(result.command).to.be(command);
                expect(result.description).to.be.a('string');
                expect(result.usage[0]).to.be.a('string');
            });
        });
    });
});
