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

var config = require('../core/config');

function save(manager) {
  // Wait for the resolve event and then for the load json event
  manager.on('resolve', function () {
    manager.on('loadJSON', function () {
      manager.json.dependencies = manager.json.dependencies || {};

      // Only include the root packages
      for (var name in manager.dependencies) {
        var curr = manager.dependencies[name][0];
        if (curr.root) {
          addDependency(manager.json, curr);
        }
      }

      // Finally save the modified json
      fs.writeFileSync(path.join(manager.cwd, config.json), JSON.stringify(manager.json, null, 2));
    }).loadJSON();
  });
}

function addDependency(json, pkg) {
  var path;
  var tag;

  if (pkg.lookedUp) {
    tag = pkg.originalTag || '~' + pkg.version;
  } else {
    path = (pkg.gitUrl || pkg.assetUrl || pkg.originalPath || '');
    tag = pkg.originalTag || '~' + pkg.version;
  }

  // If the tag is not valid (e.g.: a commit), null it
  if (!semver.valid(tag) && !semver.validRange(tag)) tag = null;

  return json.dependencies[pkg.name] = path ? path + (tag ? '#' + tag : '') : tag || 'latest';
}

module.exports = save;
