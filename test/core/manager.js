var expect = require('expect.js');
var Logger = require('bower-logger');
var Manager = require('../../lib/core/Manager');
var defaultConfig = require('../../lib/config');

describe('Manager', function () {
    var logger;

    before(function () {
        logger = new Logger();
    });

    afterEach(function () {
        logger.removeAllListeners();
    });

    function create() {
        return new Manager(defaultConfig, logger);
    }

    describe('._electSuitable', function () {
        it('should prefer exact match', function () {
            var manager;
            
            var name = 'test';
            var semvers = [
                {
                    name: 'test',
                    target: '>= 1.0.0',
                    pkgMeta: {
                        name: 'test',
                        version: '1.2.3'
                    }
                },
                {
                    name: 'test',
                    target: '1.2.3+patch.1',
                    pkgMeta: {
                        name: 'test',
                        version: '1.2.3+patch.1'
                    }
                }
            ];
            var nonSemvers = [];

            manager = create();
            manager._electSuitable(name, semvers, nonSemvers)
            .then(function (suitable) {
                expect(suitable.pkgMeta.version).to.equal('1.2.3+patch.1');
            })
            .done();
        });
    });
});
