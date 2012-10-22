// ==========================================
// BOWER: Uninstall API
// ==========================================
// Copyright 2012 Twitter, Inc
// Licensed under The MIT License
// http://opensource.org/licenses/MIT
// ==========================================

var Emitter  = require('events').EventEmitter;
var async    = require('async');
var nopt     = require('nopt');
var _        = require('lodash');

var template = require('../util/template');
var Manager  = require('../core/manager');
var save     = require('../util/save');
var help     = require('./help');

var shorthand   = { 'h': ['--help'], 'S': ['--save'] };
var optionTypes = { help: Boolean };

module.exports = function (names, options) {

  var packages, uninstallables;
  var emitter = new Emitter;
  var manager = new Manager;

  if (options.save) save.discard(emitter, manager, names);

  manager.on('data',  emitter.emit.bind(emitter, 'data'));
  manager.on('error', emitter.emit.bind(emitter, 'error'));

  var resolveLocal = function () {
    packages = _.flatten(_.values(manager.dependencies));

    uninstallables = packages.filter(function (pkg) {
      return _.include(names, pkg.name);
    });

    async.forEach(packages, function (pkg, next) {
      pkg.once('loadJSON', next).loadJSON();
    }, function () {
      showWarnings();
      uninstall();
    });
  };

  var showWarnings = function () {
    packages.forEach(function (pkg) {
      if (!pkg.json.dependencies) return;

      var conflicts = _.intersection(
        Object.keys(pkg.json.dependencies),
        _.pluck(uninstallables, 'name')
      );

      conflicts.forEach(function (conflictName) {
        template('warning-uninstall', {packageName: pkg.name, conflictName: conflictName})
          .on('data', emitter.emit.bind(emitter, 'data'));
      });
    });
  };

  var uninstall = function () {
    async.forEach(uninstallables, function (pkg, next) {
      pkg.on('uninstall', next).uninstall();
    }, emitter.emit.bind(emitter, 'end'));
  };

  manager.on('resolveLocal', resolveLocal).resolveLocal();

  return emitter;
};

module.exports.line = function (argv) {
  var options = nopt(optionTypes, shorthand, argv);

  if (options.help) return help('uninstall');
  var names   = options.argv.remain.slice(1);

  return module.exports(names, options);
};