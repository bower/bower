var assert = require('assert');
var source = require('../lib/core/source');
var nock   = require('nock');
var _      = require('lodash');

describe('endpoints', function () {

  describe('search', function() {

    it('Should use the default endpoints if none are specified', function (next) {

      var expected = [
        {
          name: 'jquery',
          url: 'path/to/jquery',
          endpoint: undefined
        },
        {
          name: 'jquery-ui',
          url: 'path/to/jquery-ui',
          endpoint: undefined
        }
      ];

      nock('https://bower.herokuapp.com')
          .get('/packages/search/jquery')
          .reply(200, expected);

      source.search('jquery', function(err, results) {
        assert.deepEqual(results, expected);
        next();
      });
    });

    it('Should use the specified endpoints', function (next) {

      var expected1 = [{
          name: 'jquery',
          url: 'path/to/jquery',
          endpoint: undefined
      }];

      var expected2 = [{
          name: 'jquery-ui',
          url: 'path/to/jquery-ui',
          endpoint: undefined
      }]

      nock('https://endpoint1.com')
          .get('/packages/search/jquery')
          .reply(200, expected1);

      nock('https://endpoint2.com')
          .get('/packages/search/jquery')
          .reply(200, expected2);

      source.search('jquery', function(err, results) {
        assert(_.find(results, function(item) {return _.isEqual(item, expected1[0])}));
        assert(_.find(results, function(item) {return _.isEqual(item, expected2[0])}));
        assert(results.length === 2);

        next();
      }, ['https://endpoint1.com/packages', 'https://endpoint2.com/packages']);

    });

    afterEach(nock.cleanAll);
  });

  describe('lookup', function() {

    it('Should use the default endpoints if none are specified', function (next) {

      var expected = {
          name: 'jquery',
          url: 'path/to/jquery'
      };

      nock('https://bower.herokuapp.com')
          .get('/packages/jquery')
          .reply(200, expected);

      source.lookup('jquery', function(err, url) {
        assert.deepEqual(url, expected.url);
        next();
      });
    });

    it('Should use the specified endpoints', function (next) {

      var expected = {
        name: 'jquery',
        url: 'path/to/jquery'
      };

      nock('https://endpoint1.com')
          .get('/packages/jquery')
          .reply(404);

      nock('https://endpoint2.com')
          .get('/packages/jquery')
          .reply(200, expected);

      source.lookup('jquery', function(err, url) {
        assert.deepEqual(url, expected.url);
        next();
      }, ['https://endpoint1.com/packages', 'https://endpoint2.com/packages']);

    });
  });

  describe('all', function() {

    it('Should use the default endpoints if none are specified', function (next) {

      var expected = [
        {
          name: 'jquery',
          url: 'path/to/jquery',
          endpoint: undefined
        },
        {
          name: 'jquery-ui',
          url: 'path/to/jquery-ui',
          endpoint: undefined
        }
      ];

      nock('https://bower.herokuapp.com')
          .get('/packages')
          .reply(200, expected);

      source.all(function(err, results) {
        assert.deepEqual(results, expected);
        next();
      });
    });

    it('Should use the specified endpoints', function (next) {

      var expected1 = [{
        name: 'jquery',
        url: 'path/to/jquery',
        endpoint: undefined
      }];

      var expected2 = [{
        name: 'jquery-ui',
        url: 'path/to/jquery-ui',
        endpoint: undefined
      }]

      nock('https://endpoint1.com')
          .get('/packages')
          .reply(200, expected1);

      nock('https://endpoint2.com')
          .get('/packages')
          .reply(200, expected2);

      source.all(function(err, results) {
        assert(_.find(results, function(item) {return _.isEqual(item, expected1[0])}));
        assert(_.find(results, function(item) {return _.isEqual(item, expected2[0])}));
        assert(results.length === 2);

        next();
      }, ['https://endpoint1.com/packages', 'https://endpoint2.com/packages']);

    });

    afterEach(nock.cleanAll);

  });

});