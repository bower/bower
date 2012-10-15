// ==========================================
// BOWER: Update API
// ==========================================
// Copyright 2012 Twitter, Inc
// Licensed under The MIT License
// http://opensource.org/licenses/MIT
// ==========================================

var Emitter = require('events').EventEmitter;
var async   = require('async');
var nopt    = require('nopt');
var _       = require('lodash');

var Manager = require('../core/manager');
var install = require('./install');
var help    = require('./help');

var shorthand   = { 'h': ['--help'] };
var optionTypes = { help: Boolean };

module.exports = function (argv, options) {
  var manager = new Manager;
  var emitter = new Emitter;

  manager.on('data',  emitter.emit.bind(emitter, 'data'));
  manager.on('error', emitter.emit.bind(emitter, 'error'));

  var installURLS = function (err, urls) {
    var installEmitter = install(urls, options);
    installEmitter.on('data',  emitter.emit.bind(emitter, 'data'));
    installEmitter.on('error', emitter.emit.bind(emitter, 'error'));
    installEmitter.on('end',   emitter.emit.bind(emitter, 'end'));
  };

  manager.once('resolveLocal', function () {
    var packages = {};

    _.each(manager.dependencies, function (value, name) {
      packages[name] = value[0];
    });

    var urls = async.map(_.values(packages), function (pkg, next) {
      pkg.once('loadJSON', function () {
        pkg.once('fetchURL', function (url) {
          next(null, url + (pkg.json.commit && pkg.json.version === '0.0.0' ? '' : '#~' + pkg.version));
        }).fetchURL();
      }).loadJSON();
    }, installURLS);
  }).resolveLocal();

  return emitter;
};

module.exports.line = function (argv) {
  var options = nopt(optionTypes, shorthand, argv);
  if (options.help) return help('update');

  var paths = options.argv.remain.slice(1);
  return module.exports(paths, options);
};