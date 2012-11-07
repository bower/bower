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

var shorthand   = { 'h': ['--help'], 'f': ['--force'] };
var optionTypes = { help: Boolean, force: Boolean };

module.exports = function (names, options) {
  var manager = new Manager([], { force: options && options.force });
  var emitter = new Emitter;

  manager.on('data',  emitter.emit.bind(emitter, 'data'));
  manager.on('error', emitter.emit.bind(emitter, 'error'));

  var installURLS = function (err, arr) {
    var mappings = {},
        urls = [];

    _.each(arr, function (info) {
      urls.push(info.url);
      mappings[info.url] = info.name;
    });

    options.endpointNames = mappings;

    // By default the manager will guess the name of the package from the url
    // But this leads to problems when the package name does not match the one in the url
    // So the manager now has an option (endpointNames) to deal with this
    manager = new Manager(urls, options);
    manager.on('data',  emitter.emit.bind(emitter, 'data'));
    manager.on('error', emitter.emit.bind(emitter, 'error'));
    manager.on('install', emitter.emit.bind(emitter, 'end'));
    manager.resolve();
  };

  manager.once('resolveLocal', function () {
    names = names.length ? _.uniq(names) : null;

    async.map(_.values(manager.dependencies), function (pkgs, next) {
      var pkg = pkgs[0];
      pkg.once('loadJSON', function () {
        pkg.once('fetchURL', function (url, type) {
          if (!url) return emitter.emit('error', new Error('No url found for ' + pkg.name));

          if (type == 'git') {
            if (pkg.json.commit && pkg.json.version === '0.0.0') url += '';
            else url += '#' + ((!names || names.indexOf(pkg.name) > -1)  ? '~' : '') + pkg.version;
          }

          next(null, { url: url, name: pkg.name });
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