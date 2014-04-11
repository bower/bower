var path = require('path');
var os = require('os');
var semver = require('semver');
var Logger = require('bower-logger');
var Q = require('q');
var cli = require('../util/cli');
var createError = require('../util/createError');


function _getHomeFilePath(filename) {
    return filename.replace(/^~\//, process.env.HOME + '/');
}

function _getRelativeFilePath(filename) {
    return path.join(process.cwd(), !filename ? 'bower.json' : filename);
}

function _getFilePath(filename) {

    var filepath = !filename ? process.cwd() + path.sep : filename;
    var firstChar = filepath[0];
    var lastChar = filepath[filepath.length - 1];

    if (firstChar === path.sep) {
        filepath = filepath;
    } else if (firstChar === '~') {
        filepath = _getHomeFilePath(filepath);
    } else {
        filepath = _getRelativeFilePath(filepath);
    }

    if (lastChar === path.sep) {
        filepath = path.join(filepath, 'bower.json');
    }

    return filepath;
}

function _isValidName(value) {
    return value !== '' && value !== undefined && value !== null;
}

function _isValidVersion(value) {
    return semver.valid(value) !== null;
}

function _isValidFile(filename) {

    var filepath = _getFilePath(filename);

    try {
        var bowerJson = require(filepath);
        return bowerJson;
    } catch (e) {
        if (e.code === 'MODULE_NOT_FOUND') {
            throw e;
        } else {
            throw createError(validate._jsonErrorMessage(filename), 'MALFORMED');
        }
    }
}

function _errorMessage(msg, filename) {
    var filepath = _getFilePath(filename);
    return msg + filepath + os.EOL;
}

// -------------------

function validate(filename) {

    var logger = new Logger();

    Q.fcall(_isValidFile, filename).then(function (bowerJson) {

        if (!_isValidName(bowerJson.name)) {
            logger.emit(
                'error',
                createError(validate._nameErrorMessage(filename), 'NO_NAME')
            );
        } else if (!_isValidVersion(bowerJson.version)) {
            logger.emit(
                'error',
                createError(validate._versionErrorMessage(filename), 'SEMVER')
            );
        } else {
            logger.emit('end', validate._successMessage(filename));
        }

    }).fail(function (e) {
        logger.emit('error', e);
    });

    return logger;
}


// Feedback messages, exposed to be used on unit tests

validate._successMessage = function (filename) {
    var filepath = _getFilePath(filename);
    var bower = require(filepath);
    return '✓  ' + bower.name + '@' + bower.version + os.EOL;
};

validate._jsonErrorMessage = function (filename) {
    return _errorMessage('Could not parse file: ', filename);
};

validate._nameErrorMessage = function (filename) {
    return _errorMessage('Could not validate name on: ', filename);
};

validate._versionErrorMessage = function (filename) {
    return _errorMessage('Could not validate version on: ', filename);
};

// -------------------

validate.line = function (argv) {
    var filename = validate.options(argv).argv.remain[1];
    return validate(filename);
};

validate.options = function (argv) {
    return cli.readOptions(argv);
};

validate.completion = function () {
    // TODO
};

module.exports = validate;
