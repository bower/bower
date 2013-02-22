// ==========================================
// BOWER: save
// ==========================================
// Copyright 2012 Twitter, Inc
// Licensed under The MIT License
// http://opensource.org/licenses/MIT
// ==========================================

var path   = require('path');
var fs     = require('fs');
var semver = require('semver');

var _      = require('lodash');

var config = require('../core/config');

function save(manager, paths) {
  // If there is specific paths to save, redirect to the appropriate function
  if (paths && paths.length) return savePkgs.apply(savePkgs, arguments);

  // Wait for the resolve event and then for the load json event
  manager.on('resolve', function (resolved) {
    if (resolved) {
      manager.on('loadJSON', function () {
        manager.json.dependencies = manager.json.dependencies || {};
        manager.json.devDependencies = manager.json.devDependencies || {};

        // Only include the root packages
        for (var name in manager.dependencies) {
          var curr = manager.dependencies[name][0];
          if (curr.root) {
            addDependency(manager.json, curr, !!manager.json.devDependencies[name]);
          }
        }

        // Cleanup dependencies from the json if empty
        if (!Object.keys(manager.json.dependencies).length) {
          delete manager.json.dependencies;
        }

        // Cleanup dependencies if empty
        if (!Object.keys(manager.json.devDependencies).length) {
          delete manager.json.devDependencies;
        }

        // Finally save the modified json
        fs.writeFileSync(path.join(manager.cwd, config.json), JSON.stringify(manager.json, null, 2));
      }).loadJSON();
    }
  });
}

function savePkgs(manager, paths, dev) {
  // Wait for the resolve event and then for the load json event
  manager.on('resolve', function (resolved) {
    if (resolved) {
      manager.on('loadJSON', function () {
        // Find the package names that match the paths
        var names = _.compact(paths.map(function (endpoint) {
          endpoint = endpoint.split('#')[0];

          return _.find(Object.keys(manager.dependencies), function (key) {
            var dep = manager.dependencies[key][0];
            if (dep.name === endpoint) return true;

            var fetchedEndpoint = dep.readEndpoint();
            return fetchedEndpoint && fetchedEndpoint.endpoint === endpoint;
          });
        }));

        var key = dev ? 'devDependencies' : 'dependencies';
        manager.json[key] = manager.json[key] || {};

        // Save each of them
        // Only include the root packages
        names.forEach(function (name) {
          addDependency(manager.json, manager.dependencies[name][0], dev);
        });

        // Finally save the modified json
        fs.writeFileSync(path.join(manager.cwd, config.json), JSON.stringify(manager.json, null, 2));
      }).loadJSON();
    }
  });
}

function addDependency(json, pkg, dev) {
  var path;
  var tag;
  var key = dev ? 'devDependencies' : 'dependencies';

  if (pkg.lookedUp) {
    tag = pkg.originalTag || '~' + pkg.version;
  } else {
    path = (pkg.gitUrl || pkg.assetUrl || pkg.originalPath || '');
    tag = pkg.originalTag || '~' + pkg.version;
  }

  // If the tag is not valid (e.g.: a commit), null it
  if (!semver.valid(tag) && !semver.validRange(tag)) tag = null;

  return json[key][pkg.name] = path ? path + (tag ? '#' + tag : '') : tag || 'latest';
}

module.exports = save;
