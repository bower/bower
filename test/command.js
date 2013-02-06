var assert   = require('assert');
var commands = require('../lib').commands;
var nock     = require('nock');

describe('command', function() {

  describe('search', function() {

    it('Should emit a packages event for search when nothing is found', function(next) {
      nock('https://bower.herokuapp.com')
          .get('/packages/search/asdf')
          .reply(200, {});

      commands.search('asdf', {}).on('packages', function(packages) {
        assert.deepEqual([], packages);
        next();
      });
    });

    it('Should emit a packages event for search when something is found', function(next) {
      var expected = [
        { name: 'fawagahds-mobile',
          url: 'git://github.com/strongbad/fawagahds-mobile.js',
          endpoint: undefined
        }
      ];

      nock('https://bower.herokuapp.com')
          .get('/packages/search/fawagahds')
          .reply(200, expected);

      commands.search('fawagahds', {}).on('packages', function(packages) {
        assert.deepEqual(packages, expected);
        next();
      });
    });

    afterEach(function() {
      nock.cleanAll();
    });
  });

  describe('lookup', function() {

    it('Should emit a package event for lookup when nothing is found', function(next) {
      nock('https://bower.herokuapp.com')
          .get('/packages/asdf')
          .reply(404);

      commands.lookup('asdf', {}).on('package', function(package) {
        assert.deepEqual([], package);
        next();
      });
    });

    it('Should emit a package event for lookup when something is found', function(next) {
      var expected = {
        name: 'fawagahds-mobile',
        url: 'git://github.com/strongbad/fawagahds-mobile.js'
      };

      nock('https://bower.herokuapp.com')
          .get('/packages/fawagahds-mobile')
          .reply(200, expected);

      commands.lookup('fawagahds-mobile', {}).on('package', function(package) {
        assert.deepEqual(package, expected);
        next();
      });

      afterEach(function() {
        nock.cleanAll();
      });
    });
  });

});