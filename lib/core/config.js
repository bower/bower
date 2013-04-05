var path = require('path');
var fs = require('fs');
var mout = require('mout');
var tmp = require('tmp');

// Guess some needed properties based on the user OS
var temp = process.env.TMPDIR
   || process.env.TMP
   || process.env.TEMP
   || process.platform === 'win32' ? 'c:\\windows\\temp' : '/tmp';

var home = (process.platform === 'win32'
    ? process.env.USERPROFILE
    : process.env.HOME) || temp;

var roaming = process.platform === 'win32'
    ? path.resolve(process.env.APPDATA || home || temp)
    : path.resolve(home || temp);

var folder = process.platform === 'win32'
    ? 'bower'
    : '.bower';

var proxy = process.env.HTTPS_PROXY
   || process.env.https_proxy
   || process.env.HTTP_PROXY
   || process.env.http_proxy;

// Setup bower config
var config;
try {
    config = require('rc')('bower', {
        cwd: process.cwd(), // TODO: read working dir from the process argv, possibly using nopt
        roaming: path.join(roaming, folder),
        json: 'component.json',
        directory: 'components',
        proxy: proxy
    });
} catch (e) {
    throw new Error('Unable to parse global .bowerrc file: ' + e.message);
}

// If there is a local .bowerrc file, merge it
var localConfig = path.join(config.cwd, '.bowerrc');
try {
    localConfig = fs.readFileSync(localConfig);
    try {
        mout.object.mixIn(config, JSON.parse(localConfig));
    } catch (e) {
        throw new Error('Unable to parse local .bowerrc file: ' + e.message);
    }
} catch (e) {}

// Configure tmp package to use graceful degradation
// If an uncaught exception occurs, the temporary directories will be deleted nevertheless
tmp.setGracefulCleanup();

module.exports = config;
