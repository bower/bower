var spawn  = require('child_process').spawn;
var path   = require('path');
var fs     = require('fs');
var rimraf = require('rimraf');

var _      = require('lodash');

// Get the previous bower version
var version = '';
var cp = spawn('bower', ['-v']);

cp
  .stdout.on('data', function (data) {
    version += data;
  })
  .on('close', function (code) {
    version = version.replace(/\n$/, '');
    if (code || !version) return;

    // The cache folders changed, so we cleanup the old cache structure
    var temp = process.env.TMPDIR
     || process.env.TMP
     || process.env.TEMP
     || process.platform === 'win32' ? 'c:\\windows\\temp' : '/tmp';

    var home = (process.platform === 'win32'
      ? process.env.USERPROFILE
      : process.env.HOME) || temp;

    var roaming =  process.platform === 'win32'
      ? path.resolve(process.env.APPDATA || home || temp)
      : path.resolve(home || temp);

    // If on windows, delete the old bower-cache folder
    if (process.platform === 'win32') {
      return rimraf(path.join(roaming, 'bower-cache'), function (err) {
        if (err) console.log('Error deleting the deprecated bower-cache folder');
      });
    }

    // If on linux / mac delete the contents inside the .bower folder, except the cache and links, need to be removed
    var folder = path.join(roaming, '.bower');
    fs.readdir(folder, function (err, files) {
      if (err) return;
      files = _.without(files, 'cache', 'links');
      files.forEach(function (file) {
        rimraf(path.join(folder, file), function (err) {
          if (err) console.log('Error deleting the deprecated .bower contents folder');
        });
      });
    });
  });
