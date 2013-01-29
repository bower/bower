// ==========================================
// BOWER: prune
// ==========================================
// Copyright 2012 Twitter, Inc
// Licensed under The MIT License
// http://opensource.org/licenses/MIT
// ==========================================

var semver   = require('semver');
var sort     = require('stable');
var template = require('./template');
var config   = require('../core/config');

var versionRequirements = function (dependencyMap) {
  var result = {};

  for (var name in dependencyMap) {
    dependencyMap[name].forEach(function (pkg) {
      result[name] = result[name] || [];
      if (pkg.originalTag && result[name].indexOf(pkg.originalTag) === -1) {
        result[name].push(pkg.originalTag);
      }
    });
  }

  return result;
};

var validVersions = function (versions, dependency) {
  if (!versions || !versions.length) return true;

  // If a non resolved dependency is passed, we simply ignore it
  if (!dependency.version) return false;

  if (!semver.valid(dependency.version)) {
    throw new Error('Invalid semver version ' + dependency.version + ' specified in ' + dependency.name);
  }

  return versions.every(function (version) {
    return semver.satisfies(dependency.version, version);
  });
};

var issueConflict = function (name, packages) {
  var versions = [];
  var error;

  packages = packages.filter(function (pkg) { return !!pkg.version; });
  packages.forEach(function (pkg) { versions.push(('v' + pkg.version).white); });

  error = new Error('No resolvable dependency for: ' + name);
  error.details = template('conflict', {
    name: name,
    packages: packages,
    json: config.json,
    versions: versions.slice(0, -1).join(', ') + ' or ' + versions[versions.length - 1]
  }, true);

  throw error;
};

module.exports = function (dependencyMap, resolve) {
  // generate version requirements
  // compare dependency map with version requirements
  // raise exceptions when requirements are not satisfied
  // select best version
  // return a pruned dependencyMap

  var result     = {};
  var versionMap = versionRequirements(dependencyMap);

  for (var name in dependencyMap) {

    var matches = dependencyMap[name].filter(validVersions.bind(this, versionMap[name]));
    if (!matches.length) {
      // No resolvable dependency
      // Check if any of those are root packages
      // If so, we assume that as the resolver (with a warning)
      // Otherwise resolve to the greater one only if resolve is true
      matches = dependencyMap[name].filter(function (pkg) { return !!pkg.root; });
      if (!matches.length) {
        if (!resolve) {
          issueConflict(name, dependencyMap[name]);
        } else {
          console.log('auto resolve');
          matches = dependencyMap[name];
        }
      } else {
        console.log('warning');
        // TODO: print warning
      }
    }

    // Sort the packages using a stable sort algorithm
    // This is because if two packages are equal, the initial order should be respected
    dependencyMap[name] = sort(matches, function (a, b) {
      if (semver.gt(a.version, b.version)) return -1;
      if (semver.lt(a.version, b.version)) return 1;

      // If the comparison determines that both packages are equal, do not give priority to local ones
      if (a.path === a.localPath && b.path !== b.localPath) return 1;
      return 0;
    });

    result[name] = [ dependencyMap[name][0] ];
  }

  return result;
};