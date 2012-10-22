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
module.exports = require('rc') ('bower', {
    cache      :  cache,
    json       : 'component.json',
    endpoint   : 'https://bower.herokuapp.com',
    directory  : 'components'
});
