var assert = require('assert');
var search = require('../lib/commands/search');
var nock   = require('nock');
var opts   = {};

describe('search', function () {

  afterEach(function () {
    nock.cleanAll();
  });

  it('Should have line method', function () {
    assert(!!search.line);
  });

  it('Should emit end event', function (next) {
    nock('https://bower.herokuapp.com')
        .get('/packages/search/asdf')
        .reply(200, {});

    search('asdf',opts)
      .on('end', function () {
        next();
      });
  });

  it('Should emit a packages event for search when nothing is found', function (next) {
    nock('https://bower.herokuapp.com')
        .get('/packages/search/asdf')
        .reply(200, {});

    search('asdf',opts).on('packages', function (packages) {
      assert.deepEqual([], packages);
      next();
    });
  });

  it('Should emit a packages event for search when something is found', function (next) {
    var expected = [
      { name: 'fawagahds-mobile',
        url: 'git://github.com/strongbad/fawagahds-mobile.js',
        endpoint: undefined
      }
    ];

    nock('https://bower.herokuapp.com')
        .get('/packages/search/fawagahds')
        .reply(200, expected);

    search('fawagahds',opts).on('packages', function (packages) {
      assert.deepEqual(packages, expected);
      next();
    });
  });

  it('Should only match exact name when exactMatch is on', function (next) {
    opts['exact-match'] = true;
    var nockResponse = [
      { name: 'fawagahds-mobile',
        url: 'git://github.com/strongbad/fawagahds-mobile.js',
        endpoint: undefined
      }
    ];

    nock('https://bower.herokuapp.com')
        .get('/packages/search/fawagahds')
        .reply(200, nockResponse);

    search('fawagahds',opts).on('packages', function (packages) {
      assert.deepEqual([], packages);
      next();
    });
  });

});