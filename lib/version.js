var findup = require('findup-sync');

module.exports = require(findup('package.json', { cwd: __dirname })).version;
