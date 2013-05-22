var path = require('path');
var os = require('os');
var mout = require('mout');
var rc = require('rc');

// Guess some needed properties based on the user OS
var temp = os.tmpdir ? os.tmpdir() : os.tmpDir();

var home = (process.platform === 'win32'
    ? process.env.USERPROFILE
    : process.env.HOME) || temp;

var roaming = process.platform === 'win32'
    ? path.join(path.resolve(process.env.APPDATA || home || temp), 'bower_new')  // TODO: change this to bower before release
    : path.join(path.resolve(home || temp), '.bower_new'); // TODO: change this to bower before release

// Guess proxy defined in the env
var proxy = process.env.HTTP_PROXY
    || process.env.http_proxy || null;

var httpsProxy = process.env.HTTPS_PROXY
    || process.env.https_proxy
    || process.env.HTTP_PROXY
    || process.env.http_proxy
    || null;

// -----------

// TODO: there are some options that are not yet being applied in the codebase

// Read rc
var rc;
try {
    rc = rc('bower', {
        'cwd': process.cwd(),
        'directory': 'bower_components',
        'registry': 'https://bower.herokuapp.com',
        'shorthand-resolver': 'git://github.com/{{owner}}/{{package}}.git',
        'roaming': roaming,
        'tmp': temp,
        'proxy': proxy,
        'https-proxy': httpsProxy,
        'ca': null,
        'strict-ssl': true,
        'user-agent': 'node/' + process.version + ' ' + process.platform + ' ' + process.arch,
        'color': true,
        'git': 'git'
    });
} catch (e) {
    throw new Error('Unable to parse runtime configuration: ' + e.message);
}

// Generate config based on the rc, making every key camelCase
var config = {};
mout.object.forOwn(rc, function (value, key) {
    key = key.replace(/_/g, '-');  // For backwards compatibility
    config[mout.string.camelCase(key)] = value;
});

// Expand roaming
config.roaming = {
    cache: path.join(config.roaming, 'cache'),
    links: path.join(config.roaming, 'links'),
    completion: path.join(config.roaming, 'completion'),
    registry: path.join(config.roaming, 'registry'),
    gitTemplate: path.join(config.roaming, 'git_template')
};

module.exports = config;
