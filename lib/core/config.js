var path       = require('path');
var fs         = require('fs');
var _          = require('lodash');
var fileExists = require('../util/file-exists').sync;

var temp = process.env.TMPDIR
 || process.env.TMP
 || process.env.TEMP
 || process.platform === 'win32' ? 'c:\\windows\\temp' : '/tmp';

var home = (process.platform === 'win32'
  ? process.env.USERPROFILE
  : process.env.HOME) || temp;

var cache = process.platform === 'win32'
  ? path.resolve(process.env.APPDATA || home || temp, 'bower-cache')
  : path.resolve(home || temp, '.bower');

// Bower Config
var config = require('rc') ('bower', {
    cache      :  cache,
    json       : 'component.json',
    endpoint   : 'https://bower.herokuapp.com',
    directory  : 'components'
});

// If there is a local .bowerrc file, merge it
var localFile = path.join(this.cwd, '.bowerrc');
if (fileExists(localFile)) {
  _.extend(config, JSON.parse(fs.readFileSync(localFile)));
}

module.exports = config;