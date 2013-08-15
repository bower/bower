var semver = require('semver');
var mout = require('mout');

function versionSatisfy(versions, target) {
    // first look for an exact match across all versions
    for (var i = 0; i < versions.length; i++) {
        if (versions[i] === target) {
            return versions[i];
        }
    }
    // if no exact match found, then return the first one that satisfies the target
    return mout.array.find(versions, function (version) {
        return semver.valid(version) && semver.satisfies(version, target);
    }, this);
}

function versionObjSatisfy(versions, target) {
    // first look for an exact match across all versions
    for (var i = 0; i < versions.length; i++) {
        if (versions[i].tag === target) {
            return versions[i];
        }
    }
    // if no exact match found, then return the first one that satisfies the target
    return mout.array.find(versions, function (version) {
        return semver.satisfies(version.version, target);
    }, this);
}

module.exports.versionSatisfy = versionSatisfy;
module.exports.versionObjSatisfy = versionObjSatisfy;
