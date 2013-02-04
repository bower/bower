var assert = require('assert');
var commands = require('../lib').commands;

describe('command', function() {

  describe('search', function() {

    it('Should emit a results event for search when nothing is found', function(next) {
      commands.search('asdf', {}).on('result', function(result) {
        assert.deepEqual([], result);
        next();
      });
    });

    it('Should emit a results event for search when something is found', function(next) {
      var expected = [
        { name: 'angular-mobile',
          url: 'git://github.com/jonniespratley/angular-mobile.js',
          endpoint: undefined
        }
      ];

      // Code review: it would be nicer to mock here
      // to avoid an external dependency on a specific github project
      commands.search('angular-mobile', {}).on('result', function(result) {
        assert.deepEqual(result, expected);
        next();
      });
    });

  });


});