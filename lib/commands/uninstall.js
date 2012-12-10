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
  var jsonDeps;

  if (!names.length) {
    process.nextTick(function () {
      emitter.emit('error', new Error('Please specify at least one package to uninstall'));
    });

    return emitter;
  }

  options = options || {};

  manager.on('data',  emitter.emit.bind(emitter, 'data'));
  manager.on('error', emitter.emit.bind(emitter, 'error'));

  var resolveLocal = function () {
    jsonDeps = manager.json.dependencies || {};
    packages = _.flatten(_.values(manager.dependencies));
    uninstallables = packages.filter(function (pkg) {
      return _.include(names, pkg.name);
    });
    async.forEach(packages, function (pkg, next) {
      pkg.once('loadJSON', next).loadJSON();
    }, function () {
      if (showWarnings(options.force) && !options.force) return;
      expandUninstallabes();
      uninstall();
    });
  };

  var showWarnings = function (force) {
    var foundConflicts = false;

    packages.forEach(function (pkg) {
      if (!pkg.json.dependencies) return;
      if (containsPkg(uninstallables, pkg)) return;

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

  var expandUninstallabes = function () {
    var x;

    // Count all packages
    count(packages, packagesCount);

    // Expand the uninstallables deps and nested deps
    // Also update the count accordingly
    for (x = uninstallables.length - 1; x >= 0; x -= 1) {
      parseUninstallableDeps(uninstallables[x]);
    }

    // Foreach uninstallable, check if it is really to be removed
    // by reading the final count
    // If a uninstallable is not suitable to be uninstalled because
    // is a shared dep, then remove it from the array
    for (x = uninstallables.length - 1; x >= 0; x -= 1) {
      var pkg = uninstallables[x];

      if (packagesCount[pkg.name] > 2) uninstallables.splice(x, 1);
      else if (packagesCount && jsonDeps[pkg.name]) uninstallables.splice(x, 1);
    }
  };

  var count = function (packages, counts) {
    packages.forEach(function (pkg) {
      counts[pkg.name] = (counts[pkg.name] || 0) + 1;

      if (jsonDeps[pkg.name]) counts[pkg.name] += 1;

      if (pkg.json.dependencies) {
        for (var key in pkg.json.dependencies) {
          count(manager.dependencies[key], counts);
        }
      }
    });
  };

  var parseUninstallableDeps = function (pkg) {
    if (!containsPkg(uninstallables, pkg)) uninstallables.push(pkg);
    if (packagesCount[pkg.name] > 0) packagesCount[pkg.name] -= 1;

    if (pkg.json.dependencies) {
      for (var key in pkg.json.dependencies) {
        parseUninstallableDeps(manager.dependencies[key][0]);
      }
    }
  };

  var containsPkg = function (packages, pkg) {
    for (var x = packages.length - 1; x >= 0; x -= 1) {
      if (packages[x].name === pkg.name) return true;
    }

    return false;
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
    if (manager.json.dependencies) {
      names.forEach(function (name) {
        delete manager.json.dependencies[name];
      });

      fs.writeFileSync(path.join(manager.cwd, config.json), JSON.stringify(manager.json, null, 2));
    }
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