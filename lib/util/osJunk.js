var osJunk = [
    // MacOSX
    /^__MACOSX$/,
    /^\.DS_Store/,
    /^\.AppleDouble$/,
    /^\.LSOverride$/,
    /\.Trashes/,
    /^\._.*/,
    /^.Spotlight-V100$/,
    /^Icon[\r\?]?/,
    // Windows
    /^ehthumbs\.db$/,
    /^Thumbs\.db$/,
    /^Desktop.ini$/
];

function isOsJunk(filename) {
    return osJunk.some(function (extra) {
        return extra.test(filename);
    });
}

function isNotOsJunk(filename) {
    return !isOsJunk(filename);
}

module.exports.isOsJunk = isOsJunk;
module.exports.isNotOsJunk = isNotOsJunk;
module.exports.osJunk = osJunk;