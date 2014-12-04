var path = require('path');
var mout = require('mout');
var Q = require('q');
var Project = require('../core/Project');
var semver = require('../util/semver');
var cli = require('../util/cli');
var defaultConfig = require('../config');
var createError = require('../util/createError');

function list(logger, options, config) {
    var project;

    options = options || {};

    // Make relative option true by default when used with paths
    if (options.paths && options.relative == null)  {
        options.relative = true;
    }

    config = defaultConfig(config);
    project = new Project(config, logger);

    return project.getTree(options)
    .spread(function (tree, flattened) {
        // Relativize paths
        // Also normalize paths on windows
        project.walkTree(tree, function (node) {
            if (node.missing) {
                return;
            }

            if (options.relative) {
                node.canonicalDir = path.relative(config.cwd, node.canonicalDir);
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
                node.canonicalDir = path.relative(config.cwd, node.canonicalDir);
            }
            if (options.paths) {
                node.canonicalDir = normalize(node.canonicalDir);
            }
        });

        // Render paths?
        if (options.sortedPaths) {
            return sortedPaths(tree, config.cwd);
        }
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
    });
}

function checkVersions(project, tree, logger) {
    var promises;
    var nodes = [];
    var repository = project.getPackageRepository();

    // Gather all nodes, ignoring linked nodes
    project.walkTree(tree, function (node) {
        if (!node.linked) {
            nodes.push(node);
        }
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

function rememberPackage(packageName, packageMain, knownDependencyMap, packageList) {
    var knownDependency = knownDependencyMap[packageName];
    if (knownDependency && !knownDependency.resolving) {
        // it's possible to hit the same dependency multiple times and as long as they're
        // not resolving, we should return the known dependency so moot.array.difference works
        packageMain = knownDependency.main;
    } else {
        knownDependencyMap[packageName] = {
            main: packageMain
        };
        packageList.push(packageMain);
    }
    return packageMain;
}

function getSimpleDependency(pkgName, knownDependencyMap) {
    var knownDependency = knownDependencyMap[pkgName];
    if (knownDependency && knownDependency.resolving) {
        // we've tried to resolve a dependency that we're still trying to find it's leaf for
        // that means circular dependency and we can't flatten the tree
        throw createError('Circular Dependency Found!');
    }
    return knownDependency;
}

function markPackageResolving(knownDependencyMap, packageName) {
    knownDependencyMap[packageName] = {
        resolving: true
    };
}

function findInsertionLevel(dependencyQueue, simpleDependencies) {
    for (var i = 0; i < dependencyQueue.length; i += 1) {
        if (!simpleDependencies.length) {
            return dependencyQueue[i];
        }
        // filter out the known dependencies at this level to find right insertion point
        simpleDependencies = mout.array.difference(simpleDependencies, dependencyQueue[i]);
    }
    return dependencyQueue[dependencyQueue.length] = [];
}

function insertPackage(dependencyQueue, bowerPkg, knownDependencyMap, cwd) {
    if (!bowerPkg || !bowerPkg.endpoint) {
        return;
    }
    markPackageResolving(knownDependencyMap, bowerPkg.endpoint.name); // mark package as resolving to detect circular dependencies
    var packagePath = normalizePaths(bowerPkg.pkgMeta && bowerPkg.pkgMeta.main, path.relative(cwd, bowerPkg.canonicalDir)),
        simpleDependencies = Object.keys(bowerPkg.pkgMeta.dependencies || {}).map(function(pkgName) {
            // process leafs of tree first
            return getSimpleDependency(pkgName, knownDependencyMap) || insertPackage(dependencyQueue, bowerPkg.dependencies[pkgName], knownDependencyMap, cwd);
        }).filter(function(item) {
            return item; // remove nulls
        }),
        insertionLevel = findInsertionLevel(dependencyQueue, simpleDependencies);

    return rememberPackage(bowerPkg.endpoint.name, packagePath, knownDependencyMap, insertionLevel);
}

function sortedPaths(tree, cwd) {
    var knownDeps = {},
        results = Object.keys(tree.dependencies).reduce(function(dependencyQueue, dependencyName){
            insertPackage(dependencyQueue, tree.dependencies[dependencyName], knownDeps, cwd);
            return dependencyQueue;
          }, []);
    return mout.array.flatten(results);
}

function normalizePaths(filepath, canonicalDir) {
    if (!filepath) {
        return [];
    }
    if (typeof filepath === 'string') {
        filepath = [filepath];
    }
    // Concatenate each main entry with the canonical dir
    return filepath.map(function(part) {
        return normalize(path.join(canonicalDir, part).trim());
    });
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
        main = normalizePaths(main, pkg.canonicalDir);

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

list.line = function (logger, argv) {
    var options = list.options(argv);
    return list(logger, options);
};

list.options = function (argv) {
    return cli.readOptions({
        'paths': { type: Boolean, shorthand: 'p' },
        'sorted-paths': { type: Boolean },
        'relative': { type: Boolean, shorthand: 'r' }
    }, argv);
};

list.completion = function () {
    // TODO:
};

module.exports = list;
