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

function save(eventType, manager, paths) {
  // Tipically wait for the resolve event and also the load json event
  manager.on(eventType, manager.on('loadJSON', function () {
    // Find the original required packages in the command
    var pkgs = paths.map(function (curr) {
      curr = curr.split('#')[0];

      return _.find(Object.keys(this.dependencies), function (key) {
        var dep = this.dependencies[key][0];
        return dep.name === curr
          || (dep.gitUrl && dep.gitUrl === curr)
          || (dep.assetUrl && dep.assetUrl === curr)
          || (dep.originalPath && dep.originalPath === curr);
      }.bind(this));

    }.bind(this));

    pkgs = _.compact(pkgs).map(function (name) {
      return this.dependencies[name][0];
    }.bind(this));

    pkgs.forEach(addDependency.bind(this));

    // Finally save the modified json
    fs.writeFileSync(path.join(this.cwd, config.json), JSON.stringify(this.json, null, 2));

  }).loadJSON.bind(manager));
}

function addDependency(pkg) {
  if (!this.json.dependencies) this.json.dependencies = {};

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

  return this.json.dependencies[pkg.name] = path ? path + (tag ? '#' + tag : '') : tag || 'latest';
}

module.exports = save.bind(this, 'resolve');