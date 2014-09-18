var util = require('util');
var Q = require('q');
var which = require('which');
var LRU = require('lru-cache');
var mout = require('mout');
var Resolver = require('./Resolver');
var semver = require('../../util/semver');
var createError = require('../../util/createError');
var cmd = require('../../util/cmd');

var hasHg;

// Check if hg is installed
try {
    which.sync('hg');
    hasHg = true;
} catch (ex) {
    hasHg = false;
}

function HgResolver(decEndpoint, config, logger) {
    Resolver.call(this, decEndpoint, config, logger);

    if (!hasHg) {
        throw createError('hg is not installed or not in the PATH', 'ENOHG');
    }
	
	// Create temp directories for each different clone
	this._tagsPath = this._createTempDir();
	this._branchesPath = this._createTempDir();
	this._clonePath = this._createTempDir();
}

util.inherits(HgResolver, Resolver);
mout.object.mixIn(HgResolver, Resolver);

// -----------------

HgResolver.getSource = function (source) {
    var uri = this._source || source;

    return uri
        .replace(/^hg\+(ssh|https?):\/\//i, '$1://')  // Change hg+ssh or hg+http or hg+https to ssh, http(s) respectively
        .replace(/\/+$/, '');  // Remove trailing slashes
};

HgResolver.prototype._hasNew = function (canonicalDir, pkgMeta) {
    var oldResolution = pkgMeta._resolution || {};

    return this._findResolution()
    .then(function (resolution) {
        // Check if resolution types are different
        if (oldResolution.type !== resolution.type) {
            return true;
        }

        // If resolved to a version, there is new content if the tags are not equal
        if (resolution.type === 'version' && semver.neq(resolution.tag, oldResolution.tag)) {
            return true;
        }

        // As last check, we compare both commit hashes
        return resolution.commit !== oldResolution.commit;
    });
};

HgResolver.prototype._resolve = function () {
	var clonePath;
	
	return this._clonePath
	.then(function (_clonePath) {
		clonePath = _clonePath;
	})
	.then(this._findResolution.bind(this, null))
    .then(function () {
		return this._clone(clonePath);
	}.bind(this));
};

// -----------------

HgResolver.prototype._clone = function (cloneTo) {
	var promise;
    var timer;
    var reporter;
    var that = this;
    var resolution = this._resolution;

    this.source = HgResolver.getSource(this._source);
	
	this._logger.action('clone', resolution.tag || resolution.branch || resolution.commit, {
        resolution: resolution,
        to: cloneTo
    });
	
	if (resolution.type === 'commit') {
        promise = cmd('hg', ['clone', this._source, '-r', resolution.commit, cloneTo]);
    } else if (resolution.type === 'branch' && resolution.branch === 'default') {
		promise = cmd('hg', ['clone', this._source, cloneTo]);
    } else if (resolution.type === 'branch') {
        promise = cmd('hg', ['clone', this._source, '-b', resolution.branch, cloneTo]);
    } else {
        promise = cmd('hg', ['clone', this._source, '-r', resolution.tag, cloneTo]);
    }

    // Throttle the progress reporter to 1 time each sec
    reporter = mout.fn.throttle(function (data) {
        var lines;

        lines = data.split(/[\r\n]+/);
        lines.forEach(function (line) {
            if (/\d{1,3}\%/.test(line)) {
                // TODO: There are some strange chars that appear once in a while (\u001b[K)
                //       Trim also those?
                that._logger.info('progress', line.trim());
            }
        });
    }, 1000);

    // Start reporting progress after a few seconds
    timer = setTimeout(function () {
        promise.progress(reporter);
    }, 8000);

    return promise
    // Add additional proxy information to the error if necessary
    .fail(function (err) {
        throw err;
    })
    // Clear timer at the end
    .fin(function () {
        clearTimeout(timer);
        reporter.cancel();
		this._tempDir = cloneTo;
    }.bind(this));
};

// -----------------

HgResolver.prototype._findResolution = function (target) {
    var err;
    var self = this.constructor;
    var that = this;

    target = target || this._target || '*';

	this._source = HgResolver.getSource(this._source);
	
    // Target is a revision, so it's a stale target (not a moving target)
    // There's nothing to do in this case
    if ((/^r\d+/).test(target)) {
        target = target.split('r');

        this._resolution = { type: 'commit', commit: target[1] };
        return Q.resolve(this._resolution);
    }
	
	// Target is a revision, so it's a stale target (not a moving target)
    // There's nothing to do in this case
    if ((/^r[a-f0-9]{4,40}/).test(target)) {
        target = target.split('r');

        this._resolution = { type: 'commit', commit: target[1] };
        return Q.resolve(this._resolution);
    }
	
    // Target is a range/version
    if (semver.validRange(target)) {
        return self.versions(this._source, true, this._tagsPath)
        .then(function (versions) {
            var versionsArr,
                version,
                index;

            versionsArr = versions.map(function (obj) { return obj.version; });

            // If there are no tags and target is *,
            // fallback to the latest commit on default
            if (!versions.length && target === '*') {
                return that._findResolution('default');
            }

            versionsArr = versions.map(function (obj) { return obj.version; });
            // Find a satisfying version, enabling strict match so that pre-releases
            // have lower priority over normal ones when target is *
            index = semver.maxSatisfyingIndex(versionsArr, target, true);
            if (index !== -1) {
                version = versions[index];
                return that._resolution = { type: 'version', tag: version.tag, commit: version.commit };
            }

            // Check if there's an exact branch/tag with this name as last resort
            return Q.all([
                self.branches(that._source, that._branchesPath),
                self.tags(that._source, that._tagsPath)
            ])
            .spread(function (branches, tags) {
                // Use hasOwn because a branch/tag could have a name like "hasOwnProperty"
                if (mout.object.hasOwn(tags, target)) {
                    return that._resolution = { type: 'tag', tag: target, commit: tags[target] };
                }
                if (mout.object.hasOwn(branches, target)) {
                    return that._resolution = { type: 'branch', branch: target, commit: branches[target] };
                }

                throw createError('No tag found that was able to satisfy ' + target, 'ENORESTARGET', {
                    details: !versions.length ?
                        'No versions found in ' + that._source :
                        'Available versions: ' + versions.map(function (version) { return version.version; }).join(', ')
                });
            });
        });
    }

    // Otherwise, target is either a tag or a branch
    return Q.all([
        self.branches(that._source, that._branchesPath),
        self.tags(that._source, that._tagsPath)
    ])
    .spread(function (branches, tags) {
        // Use hasOwn because a branch/tag could have a name like "hasOwnProperty"
		
        if (mout.object.hasOwn(tags, target)) {
            return that._resolution = { type: 'tag', tag: target, commit: tags[target] };
        }
        if (mout.object.hasOwn(branches, target)) {
            return that._resolution = { type: 'branch', branch: target, commit: branches[target] };
        }
		
        branches = Object.keys(branches);
        tags = Object.keys(tags);
		
        err = createError('Tag/branch ' + target + ' does not exist', 'ENORESTARGET');
        err.details = !tags.length ?
                'No tags found in ' + that._source :
                'Available tags: ' + tags.join(', ');
        err.details += '\n';
        err.details += !branches.length ?
                'No branches found in ' + that._source :
                'Available branches: ' + branches.join(', ');

        throw err;
	});
};

HgResolver.prototype._savePkgMeta = function (meta) {
	var version;

    if (this._resolution.type === 'version') {
        version = semver.clean(this._resolution.tag);

        // Warn if the package meta version is different than the resolved one
        if (typeof meta.version === 'string' && semver.neq(meta.version, version)) {
            this._logger.warn('mismatch', 'Version declared in the json (' + meta.version + ') is different than the resolved one (' + version + ')', {
                resolution: this._resolution,
                pkgMeta: meta
            });
        }

        // Ensure package meta version is the same as the resolution
        meta.version = version;
    } else {
        // If resolved to a target that is not a version,
        // remove the version from the meta
        delete meta.version;
    }

    // Save version/tag/commit in the release
    // Note that we can't store branches because _release is supposed to be
    // an unique id of this ref.
    meta._release = version ||
                    this._resolution.tag ||
                    this._resolution.commit;

    // Save resolution to be used in hasNew later
    meta._resolution = this._resolution;
    return Resolver.prototype._savePkgMeta.call(this, meta);
};

// ------------------------------

HgResolver.hgClone = function (source, cloneTo) {
	source = HgResolver.getSource(source);

	return Q.fcall(function () {
		return cmd('hg', ['clone', source, cloneTo], { env: process.env })
		.fail(function () {});
	});
};

HgResolver.versions = function (source, extra, cloneTo) {
    source = HgResolver.getSource(source);
	
    var value = this._cache.versions.get(source);

    if (value) {
        return Q.resolve(value)
        .then(function () {
            var versions = this._cache.versions.get(source);

            // If no extra information was requested,
            // resolve simply with the versions
            if (!extra) {
                versions = versions.map(function (version) {
                    return version.version;
                });
            }

            return versions;
        }.bind(this));
    }

	value = this.tags(source, cloneTo)
	.then(function (tags) {
        var tag;
        var version;
        var versions = [];

        // For each tag
        for (tag in tags) {
            version = semver.clean(tag);
            if (version) {
                versions.push({ version: version, tag: tag, commit: tags[tag] });
            }
        }

        // Sort them by DESC order
        versions.sort(function (a, b) {
            return semver.rcompare(a.version, b.version);
        });

        this._cache.versions.set(source, versions);

        // Call the function again to keep it DRY
        return this.versions(source, extra, cloneTo);
    }.bind(this));

    // Store the promise to be reused until it resolves
    // to a specific value
    this._cache.versions.set(source, value);

    return value;
};

HgResolver.tags = function (source, cloneTo) {
    source = HgResolver.getSource(source);

    var value = this._cache.tags.get(source);

    if (value) {
        return Q.resolve(value);
    }
    
	var clonePath;
	value = cloneTo.then(function (cloneTo) {
		clonePath = cloneTo;
	}).then(function () {
		return HgResolver.hgClone(source, clonePath);
	})
	.then(function () {
		return cmd('hg', ['tags'], { cwd: clonePath, env: process.env });
	})
    .spread(function (stout) {
        var tags = HgResolver.parseMercurialListOutput(stout.toString());
        this._cache.tags.set(source, tags);
        return tags;
    }.bind(this));

    // Store the promise to be reused until it resolves
    // to a specific value
    this._cache.tags.set(source, value);

    return value;
};

HgResolver.branches = function (source, cloneTo) {
	source = HgResolver.getSource(source);

    var value = this._cache.branches.get(source);

    if (value) {
        return Q.resolve(value);
    }

	var clonePath;
	value = cloneTo.then(function (cloneTo) {
		clonePath = cloneTo;
	}).then(function () {
		return HgResolver.hgClone(source, clonePath);
	})
	.then(function () {
		return cmd('hg', ['branches'], { cwd: clonePath, env: process.env });
	})
	.spread(function (stout) {
        var branches = HgResolver.parseMercurialListOutput(stout.toString());
        this._cache.branches.set(source, branches);
        return branches;
    }.bind(this));

    // Store the promise to be reused until it resolves
    // to a specific value
	this._cache.branches.set(source, value);

    return value;
};

HgResolver.parseMercurialListOutput = function (stout) {
    var entries = {};
    var lines = stout
        .trim()
        .split(/[\r\n]+/);

    // For each line in the refs, match only the branches
    lines.forEach(function (line) {
        var match = line.match(/([^\s]+)\s+(\d+):([0-9a-f]+)/i);

        if (match) {
            entries[match[1]] = match[2];
        }
    });
	
    return entries;
};


HgResolver.clearRuntimeCache = function () {
    // Reset cache for branches, tags, etc
    mout.object.forOwn(HgResolver._cache, function (lru) {
        lru.reset();
    });
};

HgResolver._cache = {
    branches: new LRU({ max: 50, maxAge: 5 * 60 * 1000 }),
    tags: new LRU({ max: 50, maxAge: 5 * 60 * 1000 }),
    versions: new LRU({ max: 50, maxAge: 5 * 60 * 1000 })
};

module.exports = HgResolver;