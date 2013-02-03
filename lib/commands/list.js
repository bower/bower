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

var shorthand   = { 'h': ['--help'], 'o': ['--offline'] };
var optionTypes = { help: Boolean, paths: Boolean, map: Boolean, offline: Boolean };

var getTree = function (packages, subPackages, result) {
  result = result || {};

  _.each(subPackages || packages, function (pkg) {

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
  if (typeof main === 'string') {
    return path.join(config.directory, name, main);
  } else if (_.isArray(main)) {
    main = main.map(function (main) { return generatePath(name, main); });
    return main.length === 1 ? main[0] : main;
  }
};

var buildSource = function (pkg, shallow) {
  var result = {};

  if (pkg) {
    ['main', 'scripts', 'styles', 'templates', 'images'].forEach(function (type) {
      if (pkg.json[type]) result[type] = generatePath(pkg.name, pkg.json[type]);
    });
  }

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
    var version = packages[key] ? packages[key].version || '' : null;
    var upgrade;

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
  emitter.emit('list');
};

var listManager = function (manager, emitter, options) {
  var checkVersions = false;

  manager.once('resolveLocal', function () {
    var packages = {};
    var values;

    Object.keys(manager.dependencies).forEach(function (key) {
      packages[key] = manager.dependencies[key][0];
    });

    values = _.values(packages);

    if (values.length) {
      // If the user passed the paths or map options, we don't need to fetch versions
      if (!options.offline && !options.paths && !options.map && options.argv) {
        template('action', { name: 'discover', shizzle: 'Please wait while newer package versions are being discovered' })
          .on('data', emitter.emit.bind(emitter, 'data'));
        checkVersions = true;
      }

      async.forEach(values, function (pkg, next) {
        pkg.once('loadJSON', function () {
          // Only check versions if not offline and it's a repo
          var fetchVersions = checkVersions &&
                              this.json.repository &&
                              (this.json.repository.type === 'git' || this.json.repository.type === 'local-repo');

          if (fetchVersions) {
            pkg.once('versions', function (versions) {
              pkg.tags = versions.map(function (ver) {
                return semver.valid(ver) ? semver.clean(ver) : ver;
              });
              next();
            }).versions();
          } else {
            pkg.tags = [];
            next();
          }
        }).loadJSON();
      }, function () {
        var tree = getTree(packages);
        if (!options.paths && !options.map) return cliTree(emitter, packages, tree);
        tree = options.paths ? shallowTree(packages, tree) : deepTree(packages, tree);
        emitter.emit('list', tree);
      });
    }
  }).resolveLocal();

};

var getDependencySrcs = function (list) {
  var srcs = [];
  var dependency, main;
  for (var name in list) {
    dependency = list[name];
    main = dependency.source && dependency.source.main;

    if (dependency.dependencies) {
      var depSrcs = getDependencySrcs(dependency.dependencies);
      srcs.push.apply(srcs, depSrcs);
    }

    // add main sources to srcs
    if (main) {
      if (Array.isArray(main)) {
        srcs.push.apply(srcs, main);
      } else {
        srcs.push(main);
      }
    }

  }
  return srcs;
};

var organizeSources = function (tree) {
  // flat source filepaths
  var srcs = getDependencySrcs(tree);
  // remove duplicates, organize by file extension
  var sources = {};

  srcs.forEach(function (src) {
    var ext = path.extname(src);
    sources[ext] = sources[ext] || [];
    if (sources[ext].indexOf(src) === -1) {
      sources[ext].push(src);
    }
  });

  return sources;
};

module.exports = function (options) {
  var manager = new Manager;
  var emitter = new Emitter;

  options = options || {};

  manager
    .on('data',  emitter.emit.bind(emitter, 'data'))
    .on('error', emitter.emit.bind(emitter, 'error'));


  function emitOut(obj) {
    // make JSON pretty if started from command line
    var output = options.argv ? JSON.stringify(obj, null, 2) : obj;
    emitter.emit('data', output);
  }

  if (options.sources) {
    // get map
    options.map = true;
    // with map, organize it and emit
    emitter.on('list', function (tree) {
      var sources = organizeSources(tree);
      emitOut(sources);
    });
  } else {
    emitter.on('list', function (tree) {
      if (tree) {
        emitOut(tree);
      }
    });
  }

  listManager(manager, emitter, options);

  return emitter;
};

module.exports.line = function (argv) {
  var options = nopt(optionTypes, shorthand, argv);
  if (options.help) return help('list');
  return module.exports(options);
};

module.exports.completion = function (opts, cb) {
  if (!/^-/.test(opts.word)) return cb(null, []);

  var results = Object.keys(optionTypes).map(function (option) {
    return '--' + option;
  });

  cb(null, results);
};

module.exports.completion.options = shorthand;
