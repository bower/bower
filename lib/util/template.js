// ==========================================
// BOWER: Hogan Renderer w/ template cache
// ==========================================
// Copyright 2012 Twitter, Inc
// Licensed under The MIT License
// http://opensource.org/licenses/MIT
// ==========================================

var events = require('events');
var hogan  = require('hogan.js');
var path   = require('path');
var fs     = require('fs');

var colors = require('../util/hogan-colors');

var templates = {};
var printColors = true;

module.exports = function (name, context, sync) {
  var emitter = new events.EventEmitter;

  var templateName = name + '.mustache';
  var templatePath = path.join(__dirname, '../../templates/', templateName);

  var renderFunc = printColors ? 'renderWithColors' : 'renderWithoutColors';

  if (sync) {
    if (!templates[templatePath]) templates[templatePath] = fs.readFileSync(templatePath, 'utf-8');
    return hogan.compile(templates[templatePath])[renderFunc](context);
  } else if (templates[templatePath]) {
    process.nextTick(function () {
      emitter.emit('data', hogan.compile(templates[templatePath])[renderFunc](context));
    });
  } else {
    fs.readFile(templatePath, 'utf-8', function (err, file) {
      templates[templatePath] = file;
      emitter.emit('data', hogan.compile(file)[renderFunc](context));
    });
  }

  return emitter;
};

module.exports.showColors = function (show) {
  printColors = !!show;
};