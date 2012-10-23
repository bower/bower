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
var Package = require('../core/package');
var help    = require('./help');

var shorthand   = { 'h': ['--help'], 'f': ['--force'] };
var optionTypes = { help: Boolean, force: Boolean };

module.exports = function (argv, options) {
  var manager = new Manager([], { force: options.force });
  var emitter = new Emitter;

  manager.on('data',  emitter.emit.bind(emitter, 'data'));
  manager.on('error', emitter.emit.bind(emitter, 'error'));
  manager.on('install', emitter.emit.bind(emitter, 'end'));

  manager.once('resolveLocal', function () {
    var packages = {};

    _.each(manager.dependencies, function (value, name) {
      packages[name] = value[0];
    });

    async.map(_.values(packages), function (pkg, next) {
      pkg.once('loadJSON', function () {
        pkg.once('fetchURL', function (url) {
          url = url + (pkg.json.commit && pkg.json.version === '0.0.0' ? '' : '#~' + pkg.version);
          // We can't use the install command with all the package url's
          // This would lead to problems because the package names would be guessed from the urls
          // and, in some cases, the package names do not match the ones presented in the URL
          manager.dependencies[pkg.name][0] = pkg = new Package(pkg.name, url, manager);
          pkg.once('resolve', function () {
            next();
          }).resolve();
        }).fetchURL();
      }).loadJSON();
    }, manager.install.bind(manager));
  }).resolveLocal();

  return emitter;
};

module.exports.line = function (argv) {
  var options = nopt(optionTypes, shorthand, argv);
  if (options.help) return help('update');

  var paths = options.argv.remain.slice(1);
  return module.exports(paths, options);
};