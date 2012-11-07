// ==========================================
// BOWER: SAVE
// ==========================================
// Copyright 2012 Twitter, Inc
// Licensed under The MIT License
// http://opensource.org/licenses/MIT
// ==========================================

var path   = require('path');
var fs     = require('fs');
var _      = require('lodash');

var config = require('../core/config');

function save (eventType, modifier, emitter, manager, paths) {

  manager.on(eventType, manager.on('loadJSON', function () {
    if (!this.json) return emitter.emit('error', new Error('Please define a ' + config.json));

    var pkgs = paths.map(function (path) {
      path = path.split('#')[0];
      return _.find(Object.keys(this.dependencies), function (key) {
        var dep = this.dependencies[key][0];

        return dep.name == path
          || (dep.url && dep.url == path)
          || (dep.path && dep.path == path);
      }.bind(this));

    }.bind(this));

    pkgs = _.compact(pkgs).map(function (name) {
      return this.dependencies[name][0];
    }.bind(this));

    pkgs.forEach(modifier.bind(this));

    fs.writeFileSync(path.join(this.cwd, config.json), JSON.stringify(this.json, null, 2));

  }).loadJSON.bind(manager));
}

function addDependency(pkg) {
  if (_.isUndefined(this.json.dependencies)) {
    this.json.dependencies = {};
  }
  
  if (pkg.lookedUp) return this.json.dependencies[pkg.name] = pkg.originalTag ? pkg.originalTag : 'latest';

  var path = (pkg.gitUrl || pkg.assetUrl || pkg.path || '');
  var tag  = pkg.originalTag ? '#' + pkg.originalTag : '';
  return this.json.dependencies[pkg.name] = path + tag;
}

function removeDependency(pkg) {
  delete this.json.dependencies[pkg.name];
}

module.exports         = save.bind(this, 'resolve', addDependency);
module.exports.discard = save.bind(this, 'resolveLocal', removeDependency);