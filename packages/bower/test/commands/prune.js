var expect = require('expect.js');
var helpers = require('../helpers');

var prune = helpers.command('prune');

describe('bower home', function () {

    var mainPackage = new helpers.TempDir({
        'bower.json': {
            name: 'package',
            dependencies: {
                jquery: '*'
            }
        },
        'bower_components/jquery/jquery.js': 'jquery source'
    });

    it('correctly reads arguments', function () {
        expect(prune.readOptions(['-p']))
        .to.eql([{ production: true }]);
    });

    it('correctly reads long arguments', function () {
        expect(prune.readOptions(['--production']))
        .to.eql([{ production: true }]);
    });

    it('removes extraneous packages', function () {
        mainPackage.prepare({
            'bower_components/angular/angular.js': 'angular source',
            'bower_components/angular/.bower.json': { name: 'angular' }
        });

        return helpers.run(prune, [{}, { cwd: mainPackage.path }]).then(function () {
            expect(mainPackage.exists('bower_components/angular/angular.js'))
            .to.be(false);
        });
    });

    it('leaves non-bower packages', function () {
        mainPackage.prepare({
            'bower_components/angular/angular.js': 'angular source'
        });

        return helpers.run(prune, [{}, { cwd: mainPackage.path }]).then(function () {
            expect(mainPackage.exists('bower_components/angular/angular.js'))
            .to.be(true);
        });
    });

    it('deals with custom directory', function () {
        mainPackage.prepare({
            '.bowerrc': { directory: 'components' },
            'bower_components/angular/.bower.json': { name: 'angular' },
            'bower_components/angular/angular.js': 'angular source',
            'components/angular/.bower.json': { name: 'angular' },
            'components/angular/angular.js': 'angular source'
        });

        return helpers.run(prune, [{}, { cwd: mainPackage.path }]).then(function () {
            expect(mainPackage.exists('components/angular/angular.js')).to.be(false);
            expect(mainPackage.exists('bower_components/angular/angular.js')).to.be(true);
        });
    });
});
