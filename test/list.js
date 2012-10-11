var assert = require('assert');
var events = require('events');
var list   = require('../lib/commands/list');

describe('list', function () {

  it('Should have line method', function () {
    assert(!!list.line);
  });

  it('Should return an emiter', function () {
    assert(list() instanceof events.EventEmitter);
  });

  it('returns path object with option --paths', function(next) {
      list({paths: true}).on('data', function(data) {
          assert(!!data);
          next();
      });
  });

  it('returns a map object with option -map', function(next) {
      list({map: true}).on('data', function(data) {
          assert(!!data);
          next();
      });
  });
});
