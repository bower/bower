// ==========================================
// BOWER: Public API Defintion
// ==========================================
// Copyright 2012 Twitter, Inc
// Licensed under The MIT License
// http://opensource.org/licenses/MIT
// ==========================================

var abbrev = require('abbrev');
var commands = require('./commands');

module.exports = {
  commands: commands,
  abbreviations: abbrev(Object.keys(commands)),
  config: require('./core/config')
};