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


module.exports = function (names, options) {
  var manager = new Manager([], { force: options.force });
  var emitter = new Emitter;

  var install = function (pkgs) {
    async.forEach(pkgs, function (pkg, next) {
      pkg.once('install', next).install();
      pkg.once('data', emitter.emit.bind(emitter, 'data'));
      pkg.once('error', emitter.emit.bind(emitter, 'error'));
    }, emitter.emit.bind(this, 'end'));
  };

  manager.on('data',  emitter.emit.bind(emitter, 'data'));
  manager.on('error', emitter.emit.bind(emitter, 'error'));

  manager.once('resolveLocal', function () {
    var packages = [];

    names = _.uniq(names);

    if (names.length > 0) {
      _.each(names, function (name) {
        if (!manager.dependencies[name]) {
          emitter.emit('error', new Error('Package ' + name + ' is not installed'));
          return emitter.emit('end');
        }
        packages.push(manager.dependencies[name][0]);
      });
    }
    else {
      _.each(manager.dependencies, function (value, name) {
        packages.push(value[0]);
      });
    }

    if (!packages.length) {
      emitter.emit('end');
      return emitter;
    }

    async.map(packages, function (pkg, next) {
      pkg.once('loadJSON', function () {
        pkg.once('fetchURL', function (url) {
          // We can't use the install command with all the package url's
          // This would lead to problems because the package names would be guessed from the urls
          // and, in some cases, the package names do not match the ones presented in the URL
          url = url + (pkg.json.commit && pkg.json.version === '0.0.0' ? '' : '#~' + pkg.version);
          pkg = new Package(pkg.name, url, manager);
          manager.dependencies[pkg.name] = [pkg];
          pkg.once('resolve', function () {
            next(pkg);
          }).resolve();
        }).fetchURL();
      }).loadJSON();
    }, install);
  }).resolveLocal();

  return emitter;
};

module.exports.line = function (argv) {
  var options = nopt(optionTypes, shorthand, argv);
  if (options.help) return help('update');

  var paths = options.argv.remain.slice(1);
  return module.exports(paths, options);
};