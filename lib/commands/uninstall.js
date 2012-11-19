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
var fs       = require('fs');
var path     = require('path');
var _        = require('lodash');

var template = require('../util/template');
var Manager  = require('../core/manager');
var config   = require('../core/config');
var help     = require('./help');

var optionTypes = { help: Boolean, force: Boolean, save: Boolean };
var shorthand   = { 'h': ['--help'], 'S': ['--save'], 'f': ['--force'] };

module.exports = function (names, options) {

  var packages, uninstallables, packagesCount = {};
  var emitter = new Emitter;
  var manager = new Manager;
  var force = !!options.force;

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
      if (showWarnings(force) && !force) return;
      includeShared();
      uninstall();
    });
  };

  var showWarnings = function (force) {
    var foundConflicts = false;

    packages.forEach(function (pkg) {
      if (!pkg.json.dependencies) return;
      if (uninstallables.indexOf(pkg) !== -1) return;

      var conflicts = _.intersection(
        Object.keys(pkg.json.dependencies),
        _.pluck(uninstallables, 'name')
      );

      if (conflicts.length) {
        foundConflicts = true;
        if (!force) {
          conflicts.forEach(function (conflictName) {
            emitter.emit('data', template('warning-uninstall', { packageName: pkg.name, conflictName: conflictName }, true));
          });
        }
      }
    });

    if (foundConflicts && !force) {
      emitter.emit('data', template('warn', { message: 'To proceed, run uninstall with the --force flag'}, true));
    }

    return foundConflicts;
  };

  var includeShared = function () {
    count(packages, packagesCount);

    uninstallables.forEach(function (pkg) {
      parseUninstallableDeps(pkg);
    });

    for (var name in packagesCount) {
      var pkg = manager.dependencies[name][0];
      if ((!packagesCount[name] || (packagesCount[name] === 1 && !manager.json.dependencies[name]))
        && uninstallables.indexOf(pkg) === -1) {
        if (packagesCount[name] > 0) packagesCount[name] -= 1;
        uninstallables.push(pkg);
      }
    }
  };

  var count = function (packages, counts) {
    packages.forEach(function (pkg) {
      counts[pkg.name] = (counts[pkg.name] || 0) + 1;

      if (pkg.json.dependencies) {
        for (var key in pkg.json.dependencies) {
          count(manager.dependencies[key], counts);
        }
      }
    });
  };

  var parseUninstallableDeps = function (pkg) {
    if (packagesCount[pkg.name] > 0) packagesCount[pkg.name] -= 1;

    if (pkg.json.dependencies) {
      for (var key in pkg.json.dependencies) {
        parseUninstallableDeps(manager.dependencies[key][0]);
      }
    }
  };

  var uninstall = function () {
    async.forEach(uninstallables, function (pkg, next) {
      pkg.on('uninstall', next).uninstall();
    }, function () {
      // Finally save
      if (options.save) save();
      emitter.emit.bind(emitter, 'end');
    });
  };

  var save = function () {
    names.forEach(function (name) {
      delete manager.json.dependencies[name];
    });

    fs.writeFileSync(path.join(manager.cwd, config.json), JSON.stringify(manager.json, null, 2));
  };

  manager.on('loadJSON', function () {
    manager.on('resolveLocal', resolveLocal).resolveLocal();
  }).loadJSON();

  return emitter;
};

module.exports.line = function (argv) {
  var options = nopt(optionTypes, shorthand, argv);

  if (options.help) return help('uninstall');
  var names = options.argv.remain.slice(1);

  return module.exports(names, options);
};