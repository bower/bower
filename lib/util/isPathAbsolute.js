function isPathAbsolute(filePath) {
    return filePath.charAt(0) === '/';
}

module.exports = isPathAbsolute;
