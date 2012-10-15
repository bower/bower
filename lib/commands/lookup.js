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
var help     = require('./help');

var optionTypes = { help: Boolean };
var shorthand   = { 'h': ['--help'] };

module.exports = function (name) {
  var emitter = new Emitter;

  source.lookup(name, function (err, url) {
    if (err) {
      source.search(name, function (err, packages) {
        if (packages.length) {
          template('suggestions', {packages: packages, name: name})
            .on('data', emitter.emit.bind(emitter, 'data'));
        } else {
          template('warning-missing', {name: name})
            .on('data', emitter.emit.bind(emitter, 'data'));
        }
      });

    } else {
      template('lookup', {name: name, url: url})
        .on('data', emitter.emit.bind(emitter, 'data'));
    }
  });

  return emitter;
};

module.exports.line = function (argv) {
  var options  = nopt(optionTypes, shorthand, argv);
  var names    = options.argv.remain.slice(1);

  if (options.help || !names.length) return help('lookup');
  return module.exports(names[0]);
};