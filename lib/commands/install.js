// ==========================================
// BOWER: Install API
// ==========================================
// Copyright 2012 Twitter, Inc
// Licensed under The MIT License
// http://opensource.org/licenses/MIT
// ==========================================
// Events:
//  - package: fired for every packaged once it has been resolved and installed (including dependency packages)
//  - install: fired after all dependencies have been resolved and installed
//  - error: fired on all errors
//  - data: fired when trying to output data
//  - end: fired when finished installing and the component.json has been updated (for --save/--save-dev)
// ==========================================

var Emitter = require('events').EventEmitter;
var nopt    = require('nopt');
var fs      = require('fs');
var path    = require('path');
var _       = require('lodash');

var Manager = require('../core/manager');
var config  = require('../core/config');
var source  = require('../core/source');
var save    = require('../util/save');
var help    = require('./help');

var optionTypes = { help: Boolean, save: Boolean, 'save-dev': Boolean, force: Boolean, 'force-latest': Boolean, production: Boolean };
var shorthand   = { 'h': ['--help'], 'S': ['--save'], 'D': ['--save-dev'], 'f': ['--force'], 'F': ['--force-latest'], 'p': ['--production'] };

module.exports = function (paths, options) {
  options = options || {};

  var emitter = new Emitter;
  var manager = new Manager(paths, {
    force: options.force,
    forceLatest: options['force-latest'],
    production: options.production
  });
  
  var installed = function(){
    // Iterate over the dependency listing and get the public package information.
    var packages = {};
    _.each(manager.getDeepDependencies(), function(dependencies, packageName, deepDependencies){
      packages[packageName] = packages[packageName] || [];
      _.each(dependencies, function(pkg){
        packages[packageName].push(pkg.getPublicPackage());
      });
    });
    emitter.emit('install', packages);
  };

  manager
    .on('data', emitter.emit.bind(emitter, 'data'))
    .on('error', emitter.emit.bind(emitter, 'error'))
    .on('package', function(pkg){
      emitter.emit('package', pkg.getPublicPackage());
    })
    .on('install', installed)
    .on('resolve', function (resolved) {
      if (resolved && (options.save || options['save-dev'])) {
        save(manager, paths, !options.save, emitter.emit.bind(emitter, 'end'));
      } else {
        emitter.emit('end');
      }
    })
    .resolve();

  return emitter;
};

module.exports.line = function (argv) {
  var options = nopt(optionTypes, shorthand, argv);
  var paths   = options.argv.remain.slice(1);

  if (options.help) return help('install');
  return module.exports(paths, options);
};

module.exports.completion = function (opts, cb) {
  var cache = path.join(config.completion, 'install.json');
  var done = function done(err, results) {
    if (err) return cb(err);
    var names = results.map(function (pkg) {
      return pkg.name;
    });

    return cb(null, names);
  };

  fs.readFile(cache, function (err, body) {
    if (!err) return done(null, JSON.parse(body));

    // expected error, do the first request and cache the results
    source.all(function (err, results) {
      if (err) return cb(err);
      fs.writeFile(cache, JSON.stringify(results, null, 2), function (err) {
        done(err, results);
      });
    });
  });
};

module.exports.completion.options = shorthand;
