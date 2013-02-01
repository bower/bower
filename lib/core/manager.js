// ==========================================
// BOWER: Manager Object Definition
// ==========================================
// Copyright 2012 Twitter, Inc
// Licensed under The MIT License
// http://opensource.org/licenses/MIT
// ==========================================
// Events:
//  - install: fired when everything is installed
//  - package: fired for each installed packaged
//  - resolve: fired when deps resolved (with a true/false indicating success or error)
//  - error: fired on all errors
//  - data: fired when trying to output data
//  - end: fired when finished installing
// ==========================================

var events     = require('events');
var async      = require('async');
var path       = require('path');
var glob       = require('glob');
var fs         = require('fs');
var _          = require('lodash');

var Package    = require('./package');
var UnitWork   = require('./unit_work');
var config     = require('./config');
var fileExists = require('../util/file-exists');
var template   = require('../util/template');
var prune      = require('../util/prune');

// read local dependencies (with versions)
// read json dependencies (resolving along the way into temp dir)
// merge local dependencies with json dependencies
// prune and move dependencies into local directory

var Manager = function (endpoints, opts) {
  this.dependencies = {};
  this.cwd          = process.cwd();
  this.endpoints    = endpoints || [];
  this.unitWork     = new UnitWork;
  this.opts         = opts || {};
  this.errors       = [];
};

Manager.prototype = Object.create(events.EventEmitter.prototype);
Manager.prototype.constructor = Manager;

Manager.prototype.loadJSON = function () {
  var json = path.join(this.cwd, config.json);
  fileExists(json, function (exists) {
    if (!exists) {
      // If the json does not exist, assume one
      this.json = {
        name: path.basename(this.cwd),
        version: '0.0.0'
      },
      this.name = this.json.name;
      this.version = this.json.version;
      return this.emit('loadJSON');
    }

    fs.readFile(json, 'utf8', function (err, json) {
      if (err) return this.emit('error', err);
      try {
        this.json    = JSON.parse(json);
      } catch (e) {
        return this.emit('error', new Error('There was an error while reading the ' + config.json));
      }
      this.name    = this.json.name;
      this.version = this.json.version;
      this.emit('loadJSON');
    }.bind(this));
  }.bind(this));

  return this;
};

Manager.prototype.resolve = function () {
  var resolved = function () {
    // If there is errors, report them
    if (this.errors.length) return this.reportErrors();
    // If there is an error while pruning (conflict) then abort installation
    if (!this.prune()) return this.emit('resolve', false);
    // Otherwise all is fine, so we install
    this.once('install', this.emit.bind(this, 'resolve', true)).install();
  }.bind(this);

  this.once('resolveLocal', function () {
    if (this.endpoints.length) {
      // TODO: When resolving specific endpoints we need to restore all the local
      //       packages and their hierarchy (all from the local folder)
      //       If something goes wrong, simply do resolveFromJSON before
      //       calling resolved() (slower)
      //       This will solve issue #200
      this.once('resolveEndpoints', resolved).resolveEndpoints();
    } else {
      this.once('resolveFromJson', resolved).resolveFromJson();
    }
  }).resolveLocal();

  return this;
};

Manager.prototype.resolveLocal = function () {
  glob('./' + config.directory + '/*', function (err, dirs) {
    if (err) return this.emit('error', err);
    dirs.forEach(function (dir) {
      var name = path.basename(dir);
      var pkg = new Package(name, dir, this);
      this.dependencies[name] = [];
      this.dependencies[name].push(pkg);
      pkg.on('error', function (err, origin) {
        this.errors.push({ pkg: origin || pkg, error: err });
      }.bind(this));
    }.bind(this));
    this.emit('resolveLocal');
  }.bind(this));

  return this;
};

Manager.prototype.resolveEndpoints = function () {
  // Iterate through paths
  // Add to depedencies array
  // Prune & install

  var endpointNames = this.opts.endpointNames || {};

  async.forEach(this.endpoints, function (endpoint, next) {
    var name = endpointNames[endpoint];
    var pkg  = new Package(name, endpoint, this);
    pkg.root = true;
    this.dependencies[name] = this.dependencies[name] || [];
    this.dependencies[name].push(pkg);
    pkg.on('error', function (err, origin) {
      this.errors.push({ pkg: origin || pkg, error: err });
      next();
    }.bind(this));
    pkg.once('resolve', next).resolve();
  }.bind(this), this.emit.bind(this, 'resolveEndpoints'));

  return this;
};

Manager.prototype.resolveFromJson = function () {
  // loadJSON
  // Resolve dependencies
  // Add to dependencies array
  // Prune & install

  this.once('loadJSON', function () {
    if (!this.json.dependencies) return this.emit('error', new Error('Could not find any dependencies'));

    async.forEach(Object.keys(this.json.dependencies), function (name, next) {
      var endpoint = this.json.dependencies[name];
      var pkg      = new Package(name, endpoint, this);
      pkg.root = true;
      this.dependencies[name] = this.dependencies[name] || [];
      this.dependencies[name].push(pkg);
      pkg.on('error', function (err, origin) {
        this.errors.push({ pkg: origin || pkg, error: err });
        next();
      }.bind(this));
      pkg.once('resolve', next).resolve();
    }.bind(this), this.emit.bind(this, 'resolveFromJson'));

  }.bind(this)).loadJSON();

  return this;
};

// Private
Manager.prototype.getDeepDependencies = function () {
  var result = {};

  for (var name in this.dependencies) {
    this.dependencies[name].forEach(function (pkg) {
      result[pkg.name] = result[pkg.name] || [];
      result[pkg.name].push(pkg);
      pkg.getDeepDependencies().forEach(function (pkg) {
        result[pkg.name] = result[pkg.name] || [];
        result[pkg.name].push(pkg);
      });
    });
  }

  return result;
};

Manager.prototype.prune = function () {
  var result = prune(this.getDeepDependencies(), this.opts.forceLatest);
  var name;

  // If there is conflicted deps, print them and fail
  if (result.conflicted) {
    for (name in result.conflicted) {
      this.reportConflicts(name, result.conflicted[name]);
    }

    return false;
  }

  this.dependencies = {};

  // If there is conflicted deps but they where forcebly resolved
  // Print a warning about them
  if (result.forceblyResolved) {
    for (name in result.forceblyResolved) {
      this.reportForceblyResolved(name, result.forceblyResolved[name]);
      this.dependencies[name] = result.forceblyResolved[name];
      this.dependencies[name][0].root = true;
    }
  }

  _.extend(this.dependencies, result.resolved);

  return true;
};

Manager.prototype.install = function () {
  async.forEach(Object.keys(this.dependencies), function (name, next) {
    var pkg = this.dependencies[name][0];
    pkg.once('install', function () {
      this.emit('package', pkg);
      next();
    }.bind(this)).install();
    pkg.once('error', next);
  }.bind(this), function () {
    if (this.errors.length) this.reportErrors();
    return this.emit('install');
  }.bind(this));
};

Manager.prototype.muteDependencies = function () {
  for (var name in this.dependencies) {
    this.dependencies[name].forEach(function (pkg) {
      pkg.removeAllListeners();
      pkg.on('error', function () {});
    });
  }
};

Manager.prototype.reportErrors = function () {
  template('error-summary', { errors: this.errors }).on('data', function (data) {
    this.muteDependencies();

    this.emit('data', data);
    this.emit('resolve', false);
  }.bind(this));
};

Manager.prototype.reportConflicts = function (name, packages) {
  var versions = [];
  var requirements = [];

  packages = packages.filter(function (pkg) { return !!pkg.version; });
  packages.forEach(function (pkg) {
    requirements.push({ pkg: pkg, tag: pkg.originalTag || '~' + pkg.version });
    versions.push((pkg.originalTag || '~' + pkg.version).white);
  });

  this.emit('error', new Error('No resolvable version for ' + name));
  this.emit('data', template('conflict', {
    name: name,
    requirements: requirements,
    json: config.json,
    versions: versions.slice(0, -1).join(', ') + ' or ' + versions[versions.length - 1]
  }, true));
};

Manager.prototype.reportForceblyResolved = function (name, packages) {
  var requirements = [];

  packages = packages.filter(function (pkg) { return !!pkg.version; });
  packages.forEach(function (pkg) {
    requirements.push({ pkg: pkg, tag: pkg.originalTag || '~' + pkg.version });
  });

  this.emit('data', template('resolved-conflict', {
    name: name,
    requirements: requirements,
    json: config.json,
    resolvedTo: packages[0].version,
    forceLatest: this.opts.forceLatest
  }, true));
};

module.exports = Manager;