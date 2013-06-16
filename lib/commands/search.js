// ==========================================
// BOWER: Lookup API
// ==========================================
// Copyright 2012 Twitter, Inc
// Licensed under The MIT License
// http://opensource.org/licenses/MIT
// ==========================================

var Emitter  = require('events').EventEmitter;
var nopt     = require('nopt');

var template = require('../util/template');
var source   = require('../core/source');
var install  = require('./install');
var help     = require('./help');

var optionTypes = { help: Boolean, exactMatch: Boolean };
var shorthand   = { 'h': ['--help'], 'e':['--exact-match'] };

module.exports = function (name, options) {
  var emitter = new Emitter;

  var callback = function (err, results) {
    if (err) return emitter.emit('error', err);

    emitter.emit('packages', results);

    if (results.length) {
      template('search', {results: results})
        .on('data', function (data) {
          emitter.emit('data', data);
          emitter.emit('end');
        });
    } else {
      template('search-empty', {results: results})
        .on('data', function (data) {
          emitter.emit('data', data);
          emitter.emit('end');
        });
    }
  };

  if (name) {
    source.search(name, callback, null, options['exact-match']);
  } else {
    source.all(callback);
  }

  return emitter;
};

module.exports.line = function (argv) {
  var options  = nopt(optionTypes, shorthand, argv);
  var names    = options.argv.remain.slice(1);

  if (options.help) return help('search');
  return module.exports(names[0],options);
};

module.exports.completion = install.completion;
module.exports.completion.options = shorthand;
