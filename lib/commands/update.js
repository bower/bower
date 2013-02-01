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

var Manager   = require('../core/manager');
var help      = require('./help');
var uninstall = require('./uninstall');
var save      = require('../util/save');

var optionTypes = { help: Boolean, save: Boolean, force: Boolean, 'force-latest': Boolean };
var shorthand   = { 'h': ['--help'], 'S': ['--save'], 'f': ['--force'], 'F': ['--force-latest'] };

module.exports = function (names, options) {
  options = options || {};

  var emitter = new Emitter;
  var manager = new Manager([], {
    force: options.force,
    forceLatest: options['force-latest']
  });

  manager.on('data',  emitter.emit.bind(emitter, 'data'));
  manager.on('error', emitter.emit.bind(emitter, 'error'));

  var installURLS = function (err, arr) {
    var mappings = {},
        endpoints = [];

    arr = _.compact(arr);
    _.each(arr, function (info) {
      endpoints.push(info.endpoint);
      mappings[info.endpoint] = info.name;
    });

    options.endpointNames = mappings;

    // By default the manager will guess the name of the package from the url
    // But this leads to problems when the package name does not match the one in the url
    // So the manager now has an option (endpointNames) to deal with this
    manager = new Manager(endpoints, options);

    if (options.save) save(manager);

    manager
     .on('data',  emitter.emit.bind(emitter, 'data'))
     .on('error', emitter.emit.bind(emitter, 'error'))
     .on('resolve', emitter.emit.bind(emitter, 'end', null))
     .resolve();
  };

  manager.once('resolveLocal', function () {
    names = names.length ? _.uniq(names) : null;

    async.map(_.values(manager.dependencies), function (pkgs, next) {
      var pkg = pkgs[0];
      pkg.once('loadJSON', function () {
        pkg.once('fetchEndpoint', function (endpoint) {
          if (!endpoint) return next();

          // Add tag only if the endpoint is a repository
          var json  = pkg.json;
          if (!json.commit && (!json.repository || json.repository === 'git' || json.repository === 'local-repo')) {
            endpoint += '#' + ((!names || names.indexOf(pkg.name) > -1)  ? '~' : '') + pkg.version;
          }

          next(null, { name: pkg.name, endpoint: endpoint });
        }).fetchEndpoint();
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

module.exports.completion = uninstall.completion;
module.exports.completion.options = shorthand;
