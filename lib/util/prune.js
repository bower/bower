// ==========================================
// BOWER: PRUNE
// ==========================================
// Copyright 2012 Twitter, Inc
// Licensed under The MIT License
// http://opensource.org/licenses/MIT
// ==========================================

var semver  = require('semver');
var _       = require('lodash');

var versionRequirements = function (dependencyMap) {
  var result = []

  for (var name in dependencyMap) {
    dependencyMap[name].forEach(function (pkg) {
      for (var dep in pkg.json.dependencies) {
        result[dep] = result[dep] || [];
        result[dep].concat(pkg.json.dependencies[dep]);
      }
    });
  }

  return result;
};

var validVersions = function (versions, dependency) {
  if (!versions || !versions.length) return true;

  if (!semver.valid(dependency.version)) {
    throw new Error('Invalid semver version "' + dependency.version + '" specified in ' + dependency.name);
  }

  return _.find(versions, function (version) {
    return !semver.satisfies(dependency.version, version)
  });
};

module.exports = function (dependencyMap) {
  // generate version requirements
  // compare dependency map with version requirements
  // raise exceptions when requirements are not satisified
  // remove duplicates
  // select best version
  // return a pruned dependencyMap

  var result     = {};
  var versionMap = versionRequirements(dependencyMap);

  for (var name in dependencyMap) {
    dependencyMap[name] = dependencyMap[name]
      .filter(validVersions.bind(this, versionMap[name]))
      .sort(function (a, b) { return semver.gt(a.version, b.version) ? -1 : 1; });

    if (!dependencyMap[name].length) {
      throw new Error('No resolvable dependency for: ' + name);
    }

    result[name] = [ dependencyMap[name][0] ];
  }

  return result;
};