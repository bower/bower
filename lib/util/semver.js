var semver = require('semver');
var mout = require('mout');

function satisfies(version, range, strict) {
    // Ensure it's valid
    if (!semver.valid(version)) {
        return false;
    }

    // Exact match
    if (version === range) {
        return true;
    }

    // If range is actually a pre-release version, abort
    if (strict && semver.valid(range) && isPreRelease(range)) {
        return false;
    }

    // Semver satisfies
    return semver.satisfies(version, range);
}

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
    satisfies: satisfies,
    maxSatisfying: maxSatisfying,
    maxSatisfyingIndex: maxSatisfyingIndex,
    clean: clean,
    valid: clean
});
