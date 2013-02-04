var assert   = require('assert');
var commands = require('../lib').commands;
var nock     = require('nock');

describe('command', function() {

  describe('search', function() {

    it('Should emit a results event for search when nothing is found', function(next) {
      nock('https://bower.herokuapp.com')
          .get('/packages/search/asdf')
          .reply(200, {});

      commands.search('asdf', {}).on('result', function(result) {
        assert.deepEqual([], result);
        next();
      });
    });

    it('Should emit a results event for search when something is found', function(next) {
      var expected = [
        { name: 'fawagahds-mobile',
          url: 'git://github.com/strongbad/fawagahds-mobile.js',
          endpoint: undefined
        }
      ];

      nock('https://bower.herokuapp.com')
          .get('/packages/search/fawagahds')
          .reply(200, expected);

      commands.search('fawagahds', {}).on('result', function(result) {
        assert.deepEqual(result, expected);
        next();
      });
    });

    afterEach(function() {
      nock.cleanAll();
    });

  });

  describe('lookup', function() {

    it('Should emit a results event for lookup when nothing is found', function(next) {
      nock('https://bower.herokuapp.com')
          .get('/packages/asdf')
          .reply(404);

      commands.lookup('asdf', {}).on('result', function(result) {
        assert.deepEqual([], result);
        next();
      });
    });

    it('Should emit a results event for lookup when something is found', function(next) {
      var expected = {
        name: 'fawagahds-mobile',
        url: 'git://github.com/strongbad/fawagahds-mobile.js'
      };

      nock('https://bower.herokuapp.com')
          .get('/packages/fawagahds-mobile')
          .reply(200, expected);

      commands.lookup('fawagahds-mobile', {}).on('result', function(result) {
        assert.deepEqual(result, expected);
        next();
      });

      afterEach(function() {
        nock.cleanAll();
      });
    });

  });

  describe('register', function() {

    it('Should return true if registration succeeded', function(next) {
      var name = 'oh-yeah',
          url = 'repo-oh-yeah.js';

      nock('https://bower.herokuapp.com')
          .post('/packages', 'name=' + name + '&url=' + url)
          .reply(201);

      commands.register(name, url, {silent: true}).on('result', function(result) {
        assert(result);
        next();
      });
    });

    afterEach(function() {
      nock.cleanAll();
    });

  });

});