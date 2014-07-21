var Q = require('q');
var Config = require('bower-config');
var createLink = require('../util/createLink');
var readJson = require('../util/readJson');
var path = require('path');
var fs = require('graceful-fs');

module.exports.link = function (packages, config, logger) {
    var rootComponentsDir = path.join(config.cwd, config.directory);

    // create links for new packages and make sure that existing
    // ones has all dependencies linked
    var promises = Object.keys(packages).map(function (depName) {
        var dep = packages[depName];
        var depPath = dep.canonicalDir || path.join(rootComponentsDir, dep.name);
        var conf = Config.read(depPath);
        var componentsDir = path.join(conf.cwd, conf.directory);

        return readJson(depPath)
        .spread(function (json, deprecated, assumed) {
            if (json.dependencies) {
                return Q.all(Object.keys(json.dependencies || {}).map(function (d) {
                    var dst = path.join(componentsDir, d);
                    var src = path.join(rootComponentsDir, d);

                    return Q.nfcall(fs.stat, dst)
                    .fail(function () {
                        logger.info('dep-link', d, {
                            name: json.name + '#' + d
                        });
                        return createLink(src, dst, {relative: true});
                    });
                }));
            }
        });
    });

    return Q.all(promises);
};
