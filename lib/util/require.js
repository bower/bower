// ==========================================
// BOWER: require
// ==========================================
// Copyright 2012 Twitter, Inc
// Licensed under The MIT License
// http://opensource.org/licenses/MIT
// ==========================================

var path   = require('path');
var fs     = require('fs');
var semver = require('semver');
var _      = require('lodash');
var beautifier = require('beautifier');

var template = require('../util/template');
var config = require('../core/config');

function generateRequire(eventType, manager, paths) {

  // requirejs configuration
  var requirejs = { packages: {}, shim: {} }

  // loopdy-loop
  for (var i in manager.unitWork.data) {
    var e = manager.unitWork.data[i];
    requirejs.packages[i] = {};
    requirejs.packages[i].name = e.json.name;
    requirejs.packages[i].location = config.directory + '/' + e.json.name;
    if (e.json.main) requirejs.packages[i].main =  e.json.main;
  }
  
  // text padding that mimics jamjs
  var padding_left = 'var bower = ';
  var padding_right = 'if (typeof require !== "undefined" && require.config) { require.config({packages: bower.packages, shim: bower.shim}); } else { var require = {packages: bower.packages, shim: bower.shim}; } if (typeof exports !== "undefined" && typeof module !== "undefined") { module.exports = bower; }';

  // we make it beautiful
  var beautified = beautifier.js_beautify(padding_left + JSON.stringify(requirejs) + padding_right);

  // write to file
  fs.writeFileSync(path.join(this.cwd, config.directory, 'require.config.js'), beautified);

}

module.exports = generateRequire.bind(this, 'resolve');