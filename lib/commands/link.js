// ==========================================
// BOWER: Link API
// ==========================================
// Copyright 2012 Twitter, Inc
// Licensed under The MIT License
// http://opensource.org/licenses/MIT
// ==========================================

var Emitter    = require('events').EventEmitter;
var nopt       = require('nopt');
var fs         = require('fs');
var path       = require('path');
var mkdirp     = require('mkdirp');

var Manager    = require('../core/manager');
var help       = require('./help');
var template   = require('../util/template');
var config     = require('../core/config');

var optionTypes = { help: Boolean };
var shorthand   = { 'h': ['--help'] };

function linkSelf(emitter) {
  var manager = new Manager;

  manager
    .on('error', emitter.emit.bind('error'))
    .once('loadJSON', function () {
      var destPath = path.join(config.links, manager.name);
      var srcPath = process.cwd();

      deleteLink(destPath, function (err) {
        if (err) return emitter.emit('error', err);

        createLink(srcPath, destPath, function (err) {
          if (err) return emitter.emit('error', err);

          template('link', { src: srcPath, dest: destPath })
            .on('data', emitter.emit.bind(emitter, 'end'));
        });
      });
    }).loadJSON();
}

function linkTo(name, emitter) {
  var destPath = path.join(process.cwd(), config.directory, name);
  var srcPath = path.join(config.links, name);

  deleteLink(destPath, function (err) {
    if (err) return emitter.emit('error', err);

    createLink(srcPath, destPath, function (err) {
      if (err) return emitter.emit('error', err);

      template('link', { src: srcPath, dest: destPath })
        .on('data', emitter.emit.bind(emitter, 'end'));
    });
  });
}

function deleteLink(dest, callback) {
  // Delete symlink if already present
  fs.lstat(dest, function (err) {
    if (!err || err.code !== 'ENOENT') fs.unlink(dest, callback);
    else callback();
  });
}

function createLink(src, dest, callback) {
  var destDir = path.dirname(dest);

  // Create directory
  mkdirp(destDir, function (err) {
    if (err) return callback(err);

    fs.lstat(src, function (err) {
      if (err && err.code === 'ENOENT') {
        return callback(new Error('Attempting to link an unknown package: ' + path.basename(src)));
      }

      // Create symlink
      fs.symlink(src, dest, 'dir', function (err) {
        if (err) return callback(err);
        callback();
      });
    });
  });
}

module.exports = function (name) {
  var emitter = new Emitter;

  if (!name) linkSelf(emitter);
  else linkTo(name, emitter);

  return emitter;
};

module.exports.line = function (argv) {
  var options  = nopt(optionTypes, shorthand, argv);
  var name     = options.argv.remain[1];

  if (options.help) return help('link');
  return module.exports(name);
};