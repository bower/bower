// ==========================================
// BOWER: Source Api
// ==========================================
// Copyright 2012 Twitter, Inc
// Licensed under The MIT License
// http://opensource.org/licenses/MIT
// ==========================================

var request  = require('request');
var _        = require('lodash');
var config   = require('./config');

var endpoint = config.endpoint + '/packages';

if (process.env.HTTP_PROXY) {
  request = request.defaults({'proxy': process.env.HTTP_PROXY});
}

exports.lookup = function (name, callback) {
  request.get(endpoint + '/' + encodeURIComponent(name), function (err, response, body) {
    if (err || response.statusCode !== 200) return callback(err || new Error(name + ' not found'));
    callback(err, body && JSON.parse(body).url);
  });
};

exports.register = function (name, url, callback) {
  var body = {name: name, url: url};

  request.post({url: endpoint, form: body}, function (err, response, body) {
    if (err) return callback(err);

    if (response.statusCode === 406) {
      return callback(new Error('Duplicate package'));
    }

    if (response.statusCode === 400) {
      return callback(new Error('Incorrect format'));
    }

    if (response.statusCode !== 201) {
      return callback(new Error('Unknown error: ' + response.statusCode));
    }

    callback();
  });
};

exports.search = function (name, callback) {
  request.get(endpoint + '/search/' + encodeURIComponent(name), function (err, response, body) {
    callback(err, body && JSON.parse(body));
  });
};

exports.info = function (name, callback) {
  exports.lookup(name, function (err, url) {
    if (err) return callback(err);

    var Package = require('./package');
    var pkg     = new Package(name, url);

    pkg.once('resolve', function () {
      pkg.once('versions', function (versions) {
        callback(null, { pkg: pkg, versions: versions });
      }).versions();
    }).resolve();
  });
};

exports.all = function (callback) {
  request.get(endpoint, function (err, response, body) {
    callback(err, body && JSON.parse(body));
  });
};
