var semver = require('semver');
var mout = require('mout');

function maxSatisfying(versions, range, strict) {
    var version;
    var filteredVersions;

    // Ensure it's a valid range
    if (!semver.validRange(range)) {
        return null;
    }

    // Exact match
    version = mout.array.find(versions, function (version) {
        return version === range;
    });
    if (version) {
        return version;
    }

    // If strict matching is enabled,
    // filter pre-release versions from the array
    if (strict) {
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

function maxSatisfyingIndex(versions, range, strict) {
    var version = maxSatisfying(versions, range, strict);

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
