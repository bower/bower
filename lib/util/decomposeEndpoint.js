var createError = require('./createError');

function decomposeEndpoint(endpoint) {
    var regExp = /^(?:([\w\-]|(?:[\w\.\-]+[\w\-])?)\|)?([^\|#]+)(?:#(.*))?$/;
    var matches = endpoint.match(regExp);

    if (!matches) {
        throw createError('Invalid endpoint: "' + endpoint + '"', 'EINVEND');
    }

    return {
        name: matches[1],
        source: matches[2],
        target: matches[3]
    };
}

module.exports = decomposeEndpoint;