var path = require('path');
var mout = require('mout');
var Q = require('q');
var Logger = require('bower-logger');
var Project = require('../core/Project');
var semver = require('../util/semver');
var cli = require('../util/cli');
var defaultConfig = require('../config');

function list(options, config) {
    var project;
    var logger = new Logger();

    options = options || {};

    // Make relative option true by default when used with paths
    if (options.paths && options.relative == null)  {
        options.relative = true;
    }

    config = mout.object.deepFillIn(config || {}, defaultConfig);
    project = new Project(config, logger);

    project.getTree()
    .spread(function (tree, flattened) {
        var baseDir = path.dirname(path.join(config.cwd, config.directory));

        // Relativize paths
        // Also normalize paths on windows
        project.walkTree(tree, function (node) {
            if (node.missing) {
                return;
            }

            if (options.relative) {
                node.canonicalDir = path.relative(baseDir, node.canonicalDir);
            }
            if (options.paths) {
                node.canonicalDir = normalize(node.canonicalDir);
            }
        }, true);

        // Note that we need to to parse the flattened tree because it might
        // contain additional packages
        mout.object.forOwn(flattened, function (node) {
            if (node.missing) {
                return;
            }

            if (options.relative) {
                node.canonicalDir = path.relative(baseDir, node.canonicalDir);
            }
            if (options.paths) {
                node.canonicalDir = normalize(node.canonicalDir);
            }
        });

        // Render paths?
        if (options.paths) {
            return paths(flattened);
        }

        // Do not check for new versions?
        if (config.offline) {
            return tree;
        }

        // Check for new versions
        return checkVersions(project, tree, logger)
        .then(function () {
            return tree;
        });
    })
    .done(function (value) {
        logger.emit('end', value);
    }, function (error) {
        logger.emit('error', error);
    });

    logger.json = !!options.paths;

    return logger;
}

function checkVersions(project, tree, logger) {
    var promises;
    var nodes = [];
    var repository = project.getPackageRepository();

    // Gather all nodes
    project.walkTree(tree, function (node) {
        nodes.push(node);
    }, true);

    if (nodes.length) {
        logger.info('check-new', 'Checking for new versions of the project dependencies..');
    }

    // Check for new versions for each node
    promises = nodes.map(function (node) {
        var target = node.endpoint.target;

        return repository.versions(node.endpoint.source)
        .then(function (versions) {
            node.versions = versions;

            // Do not check if node's target is not a valid semver one
            if (versions.length && semver.validRange(target)) {
                node.update = {
                    target: semver.maxSatisfying(versions, target),
                    latest: semver.maxSatisfying(versions, '*')
                };
            }
        });
    });

    // Set the versions also for the root node
    tree.versions = [];

    return Q.all(promises);
}

function paths(flattened) {
    var ret = {};

    mout.object.forOwn(flattened, function (pkg, name) {
        var main;

        if (pkg.missing) {
            return;
        }

        main = pkg.pkgMeta.main;

        // If no main was specified, fallback to canonical dir
        if (!main) {
            ret[name] = pkg.canonicalDir;
            return;
        }

        // Normalize main
        if (typeof main === 'string') {
            main = [main];
        }

        // Concatenate each main entry with the canonical dir
        main = main.map(function (part) {
            return normalize(path.join(pkg.canonicalDir, part).trim());
        });

        // If only one main file, use a string
        // Otherwise use an array
        ret[name] = main.length === 1 ? main[0] : main;
    });

    return ret;
}

function normalize(src) {
    return src.replace(/\\/g, '/');
}

// -------------------

list.line = function (argv) {
    var options = list.options(argv);
    return list(options);
};

list.options = function (argv) {
    return cli.readOptions({
        'paths': { type: Boolean, shorthand: 'p' },
        'relative': { type: Boolean, shorthand: 'r' }
    }, argv);
};

list.completion = function () {
    // TODO:
};

module.exports = list;
