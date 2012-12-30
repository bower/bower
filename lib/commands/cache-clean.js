// ==========================================
// BOWER: CacheClean API
// ==========================================
// Copyright 2012 Twitter, Inc
// Licensed under The MIT License
// http://opensource.org/licenses/MIT
// ==========================================

var Emitter     = require('events').EventEmitter;
var async       = require('async');
var nopt        = require('nopt');
var rimraf      = require('rimraf');
var path        = require('path');
var glob        = require('glob');
var _           = require('lodash');

var help        = require('./help');
var config      = require('../core/config');
var template    = require('../util/template');
var fileExists  = require('../util/file-exists');

var optionTypes = { help: Boolean };
var shorthand   = { 'h': ['--help'] };

var removePkg = function (pkg, emitter, next) {
  var folder = path.join(config.cache, pkg);

  fileExists(folder, function (exists) {
    var err;

    if (!exists) {
      err = new Error('Package ' + pkg + ' is not installed');
      emitter.emit('error', err);
      return next(err);
    }

    rimraf(folder, function (err) {
      if (err) {
        emitter.emit('error', err);
        return next(err);
      }

      emitter.emit('data', template('action', { name: 'cleared', shizzle: pkg }, true));
      next();
    });
  });
};

var createFuncs = function (pkgs, emitter) {
  return pkgs.map(function (pkg) {
    pkg = pkg.replace(/^\.\//, '');
    return removePkg.bind(removePkg, pkg, emitter);
  });
};

var cleanCompletion = function (emitter, next) {
  fileExists(config.completion, function (exists) {
    if (!exists) return next();

    rimraf(config.completion, function (err) {
      if (err) {
        emitter.emit('error', err);
        return next(err);
      }

      emitter.emit('data', template('action', { name: 'cleared', shizzle: 'completion cache' }, true));
      next();
    });
  });
};

module.exports = function (pkgs) {
  var emitter = new Emitter;
  var funcs;

  // If no pkgs are passed we delete all
  // Otherwise we delete the passed ones
  if (!pkgs || !pkgs.length) {
    glob('./*', { cwd: config.cache }, function (err, dirs) {
      if (err) return emitter.emit('error', err);
      pkgs = dirs;
      funcs = createFuncs(pkgs, emitter);

      // If all the cache is to be cleared,
      // also clear the completion cache
      funcs.push(cleanCompletion.bind(cleanCompletion, emitter));

      async.parallel(funcs, emitter.emit.bind(emitter, 'end'));
    });
  } else {
    funcs = createFuncs(_.uniq(pkgs), emitter);
    async.parallel(funcs, emitter.emit.bind(emitter, 'end'));
  }

  return emitter;
};

module.exports.line = function (argv) {
  var options  = nopt(optionTypes, shorthand, argv);
  var pkgs     = options.argv.remain.slice(1);

  if (options.help) return help('cache-clean');
  return module.exports(pkgs);
};

module.exports.completion = function (opts, cb) {
  glob('./*', { cwd: config.cache }, function (err, dirs) {
    if (err) return cb(err);
    dirs = dirs.map(function (dir) {
      return dir.replace(/^\.\//, '');
    });
    cb(null, dirs);
  });
};

module.exports.completion.options = shorthand;
