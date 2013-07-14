function decompose(endpoint) {
    var regExp = /^(?:([\w\-]|(?:[\w\.\-]+[\w\-])?)=)?([^\|#]+)(?:#(.*))?$/;
    var matches = endpoint.match(regExp);
    var target;
    var error;

    if (!matches) {
        error = new Error('Invalid endpoint: ' + endpoint);
        error.code = 'EINVEND';
        throw error;
    }

    target = matches[3];

    return {
        name: matches[1] || '',
        source: matches[2],
        target: !target || target === 'latest' ? '*' : target
    };
}

function compose(decEndpoint) {
    var composed = '';

    if (decEndpoint.name) {
        composed += decEndpoint.name + '=';
    }

    composed += decEndpoint.source;

    if (!isWildcard(decEndpoint.target)) {
        composed += '#' + decEndpoint.target;
    }

    return composed;
}

function json2decomposed(key, value) {
    var endpoint = key + '=';
    var split = value.split('#');

    // If # was found, the source was specified
    if (split.length > 1) {
        endpoint += split[0] + '#' + split[1];
    // If value has a /, it's probably a source
    } else if (value.indexOf('/') !== -1) {
        endpoint += value + '#*';
    // Otherwise use the key as the source
    } else {
        endpoint += key + '#' + split[0];
    }

    return decompose(endpoint);
}

function decomposed2json(decEndpoint) {
    var error;
    var key = decEndpoint.name;
    var value = '';
    var ret = {};

    if (!key) {
        error = new Error('Decomposed endpoint must have a name');
        error.code = 'EINVEND';
        throw error;
    }

    if  (decEndpoint.source !== decEndpoint.name) {
        value += decEndpoint.source + '#';
    }

    if (!isWildcard(decEndpoint.target)) {
        value += decEndpoint.target;
    }

    ret[key] = value;

    return ret;
}

function isWildcard(target) {
    return !target || target === '*' || target === 'latest';
}

module.exports.decompose = decompose;
module.exports.compose = compose;
module.exports.json2decomposed = json2decomposed;
module.exports.decomposed2json = decomposed2json;
