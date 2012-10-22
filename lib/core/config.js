var path = require('path');

var temp = process.env.TMPDIR
 || process.env.TMP
 || process.env.TEMP
 || process.platform === "win32" ? "c:\\windows\\temp" : "/tmp";

var home = (process.platform === "win32"
  ? process.env.USERPROFILE
  : process.env.HOME) || temp;

var cache = process.platform === "win32"
  ? path.resolve(process.env.APPDATA || home || temp, "bower-cache")
  : path.resolve(home || temp, ".bower");

// Bower Config

var config = {
    cache      :  cache,
    json       : 'component.json',
    endpoint   : 'https://bower.herokuapp.com',
    directory  : 'components'
}

module.exports = require('rc') ('bower', config);

// Set config values through public api
module.exports.set = function(key, val){
  config[key] = val;
}
