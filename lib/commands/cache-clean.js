// ==========================================
// BOWER: CacheClean API
// ==========================================
// Copyright 2012 Twitter, Inc
// Licensed under The MIT License
// http://opensource.org/licenses/MIT
// ==========================================

var Emitter  = require('events').EventEmitter;
var async    = require('async');
var nopt     = require('nopt');
var rimraf   = require('rimraf');
var path     = require('path');
var fs       = require('fs');
var glob     = require('glob');

var help     = require('./help');
var config   = require('../core/config');
var template = require('../util/template');

var optionTypes = { help: Boolean, force: Boolean };
var shorthand   = { 'h': ['--help'], 'S': ['--save'], 'f': ['--force'] };

var removePkg = function (pkg, emitter, next) {
  var folder = path.join(config.cache, pkg);

  fs.exists(folder, function (exists) {
    if (!exists) emitter.emit('error', new Error(pkg + ' is not cached'));
    else {
      rimraf(folder, function (err) {
        if (err) emitter.emit('error', err);
        else {
          emitter.emit('data', template('action', { name: 'cleared', shizzle: pkg }, true));
          next();
        }
      });
    }
  });
};

var createFuncs = function (pkgs, emitter) {
  return pkgs.map(function (pkg) {
    pkg = pkg.replace(/^\.\//, '');
    return removePkg.bind(removePkg, pkg, emitter);
  });
};

module.exports = function (pkgs) {
  var emitter = new Emitter;

  if (!pkgs.length) {
    glob('./*', { cwd: config.cache }, function (err, dirs) {
      if (err) return emitter.emit('error', err);
      pkgs = dirs;
      async.parallel(createFuncs(pkgs, emitter));
    });
  } else {
    async.parallel(createFuncs(pkgs, emitter));
  }

  return emitter;
};

module.exports.line = function (argv) {
  var options  = nopt(optionTypes, shorthand, argv);
  var pkgs     = options.argv.remain.slice(1);

  if (options.help) return help('cache-clean');
  return module.exports(pkgs, options);
};
