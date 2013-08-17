var semver = require('semver');
var mout = require('mout');

function maxSatisfying(versions, range, strictMatch) {
    var version;
    var filteredVersions;

    // Exact match
    version = mout.array.find(versions, function (version) {
        return version === range;
    });
    if (version) {
        return version;
    }

    // When strict match is enabled and range is *,
    // give priority to non-pre-releases
    // We do this by filtering every pre-release version
    range = range.trim();
    if (strictMatch && (!range || range === '*')) {
        filteredVersions = versions.map(function (version) {
            return !isPreRelease(version) ? version : null;
        });

        version = semver.maxSatisfying(filteredVersions, range);
        if (version) {
            return version;
        }
    }

    // Semver max satisfies
    return semver.maxSatisfying(versions, range);
}

function maxSatisfyingIndex(versions, range, strictMatch) {
    var version = maxSatisfying(versions, range, strictMatch);

    if (!version) {
        return -1;
    }

    return versions.indexOf(version);
}

function clean(version) {
    var parsed = semver.parse(version);

    if (!parsed) {
        return null;
    }

    // Keep builds!
    return parsed.version + (parsed.build.length ? '+' + parsed.build.join('.') : '');
}

function isPreRelease(version) {
    var parsed = semver.parse(version);
    return parsed && parsed.prerelease && parsed.prerelease.length;
}

// Export a semver like object but with our custom functions
mout.object.mixIn(module.exports, semver, {
    maxSatisfying: maxSatisfying,
    maxSatisfyingIndex: maxSatisfyingIndex,
    clean: clean,
    valid: clean
});
