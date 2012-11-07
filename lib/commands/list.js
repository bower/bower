// ==========================================
// BOWER: List API
// ==========================================
// Copyright 2012 Twitter, Inc
// Licensed under The MIT License
// http://opensource.org/licenses/MIT
// ==========================================

var Emitter = require('events').EventEmitter;
var semver  = require('semver');
var archy   = require('archy');
var async   = require('async');
var nopt    = require('nopt');
var path    = require('path');
var _       = require('lodash');

var template = require('../util/template');
var Manager  = require('../core/manager');
var Package  = require('../core/package');
var config   = require('../core/config');
var help     = require('./help');

var shorthand   = { 'h': ['--help'] };
var optionTypes = { help: Boolean, paths: Boolean, map: Boolean };

var getTree = function (packages, subPackages, result) {
  result = result || {};

  _.each(subPackages || packages, function (pkg, name) {

    result[pkg.name] = {};

    Object.keys(pkg.json.dependencies || {}).forEach(function (name) {
      result[pkg.name][name] = {};
    });

    var subPackages = {};

    Object.keys(pkg.json.dependencies || {}).forEach(function (name) {
      subPackages[name] = packages[name] || new Package(name, null);
    });

    getTree(packages, subPackages, result[pkg.name]);
  });

  return result;
};

var generatePath = function (name, main) {
  if (typeof main == 'string') {
    return path.join(config.directory, name, main);
  } else if (_.isArray(main)) {
    main = main.map(function (main) { return generatePath(name, main); });
    return main.length == 1 ? main[0] : main;
  }
};

var buildSource = function (pkg, shallow) {
  var result = {};

  ['main', 'scripts', 'styles', 'templates', 'images'].forEach(function (type) {
    if (pkg.json[type]) result[type] = generatePath(pkg.name, pkg.json[type]);
  });

  if (shallow) {
    result.main = result.main      ? result.main
                : result.scripts   ? result.scripts
                : result.styles    ? result.styles
                : result.templates ? result.templates
                : result.images    ? result.images
                : generatePath(pkg.name, '');
  }

  return result;
};

var shallowTree = function (packages, tree) {
  var result = {};

  Object.keys(tree).forEach(function (packageName) {
    result[packageName] = buildSource(packages[packageName], true).main;
  });

  return result;
};

var deepTree = function (packages, tree) {

  var result = {};

  Object.keys(tree).forEach(function (packageName) {

    result[packageName] = {};
    result[packageName].source = buildSource(packages[packageName]);

    if (Object.keys(tree[packageName]).length) {
      result[packageName].dependencies = deepTree(packages, tree[packageName]);
    }

  });

  return result;
};

var getNodes = function (packages, tree) {
  return Object.keys(tree).map(function (key) {
    var upgrade;

    var version = packages[key].json.repository
      && packages[key].json.repository.type == 'asset'
      && packages[key]
      && packages[key].version == '0.0.0' ?
         packages[key].json.repository.url : packages[key] && packages[key].version;

    if (version && packages[key].tags.indexOf(version)) {
      upgrade = packages[key].tags[0];
    }

    if (Object.keys(tree[key]).length) {
      return {
        label: template('tree-branch', { 'package': key, version: version, upgrade: upgrade }, true),
        nodes: getNodes(packages, tree[key])
      };
    } else {
      return template('tree-branch', { 'package': key, version: version, upgrade: upgrade }, true);
    }
  });
};

var cliTree = function (emitter, packages, tree) {
  emitter.emit('data', archy({
    label: process.cwd(),
    nodes: getNodes(packages, tree)
  }));
};

module.exports = function (options) {
  var manager = new Manager;
  var emitter = new Emitter;

  options = options || {};

  manager.on('data',  emitter.emit.bind(emitter, 'data'));
  manager.on('error', emitter.emit.bind(emitter, 'error'));

  manager.once('resolveLocal', function () {
    var packages = {};

    Object.keys(manager.dependencies).forEach(function (key) {
      packages[key] = manager.dependencies[key][0];
    });

    async.forEach(_.values(packages), function (pkg, next) {
      pkg.once('loadJSON', function () {
        if (this.json.repository && this.json.repository.type == 'git') {
          pkg.once('versions', function (versions) {
            pkg.tags = versions.map(semver.clean);
            next();
          }).versions();
        } else {
          pkg.tags = [];
          next();
        }
      }).loadJSON();
    }, function () {
      var tree = getTree(packages);
      if (!options.paths && !options.map && options.argv) return cliTree(emitter, packages, tree);
      tree = options.paths ? shallowTree(packages, tree) : deepTree(packages, tree);
      emitter.emit('data', options.argv ? JSON.stringify(tree, null, 2) : tree);
    });

  }).resolveLocal();

  return emitter;
};

module.exports.line = function (argv) {
  var options = nopt(optionTypes, shorthand, argv);
  if (options.help) return help('list');
  return module.exports(options);
};