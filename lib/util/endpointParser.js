var createError = require('./createError');

function decompose(endpoint) {
    var regExp = /^(?:([\w\-]|(?:[\w\.\-]+[\w\-])?)\|)?([^\|#]+)(?:#(.*))?$/;
    var matches = endpoint.match(regExp);

    if (!matches) {
        throw createError('Invalid endpoint: "' + endpoint + '"', 'EINVEND');
    }

    return {
        name: matches[1] || '',
        source: matches[2],
        target: matches[3] || '*'
    };
}

function compose(decEndpoint) {
    var composed = '';

    if (decEndpoint.name) {
        composed += decEndpoint.name + '|';
    }

    composed += decEndpoint.source;

    if (decEndpoint.target) {
        composed += '#' + decEndpoint.target;
    }

    return composed;
}

module.exports.decompose = decompose;
module.exports.compose = compose;