function isAbsolutePath(filePath) {
    return filePath.charAt(0) === '/';
}

module.exports = isAbsolutePath;
