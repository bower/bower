var os = require('os');
var path = require('path');
var paths = require('./paths');

// Guess proxy defined in the env
/*jshint camelcase: false*/
var proxy = process.env.HTTP_PROXY
    || process.env.http_proxy
    || null;

var httpsProxy = process.env.HTTPS_PROXY
    || process.env.https_proxy
    || process.env.HTTP_PROXY
    || process.env.http_proxy
    || null;
/*jshint camelcase: true*/

var defaults = {
    'cwd': process.cwd(),
    'directory': 'bower_components',
    'registry': 'https://bower.herokuapp.com',
    'shorthand-resolver': 'git://github.com/{{owner}}/{{package}}.git',
    'tmp': os.tmpdir ? os.tmpdir() : os.tmpDir(),
    'proxy': proxy,
    'https-proxy': httpsProxy,
    'timeout': 30000,
    'ca': { search: [] },
    'strict-ssl': true,
    'user-agent': 'node/' + process.version + ' ' + process.platform + ' ' + process.arch,
    'color': true,
    'interactive': false,
    'storage': {
        packages: path.join(paths.cache, 'packages'),
        links: path.join(paths.data, 'links'),
        completion: path.join(paths.data, 'completion'),
        registry: path.join(paths.cache, 'registry'),
        git: path.join(paths.data, 'git')
    }
};

module.exports = defaults;
