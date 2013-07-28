function decompose(endpoint) {
    // Note that we allow spaces in targets and sources but they are trimmed
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
        source: (matches[2]).trim(),
        target: !target || target === 'latest' ? '*' : target.trim()
    };
}

function compose(decEndpoint) {
    var composed = '';

    if (decEndpoint.name) {
        composed += decEndpoint.name.trim() + '=';
    }

    composed += decEndpoint.source.trim();

    if (!isWildcard(decEndpoint.target)) {
        composed += '#' + decEndpoint.target.trim();
    }

    return composed;
}

function json2decomposed(key, value) {
    var endpoint = key.trim() + '=';
    var split = value.split('#');

    // If # was found, the source was specified
    if (split.length > 1) {
        endpoint += (split[0] || key).trim() + '#' + split[1].trim();
    // Check if value looks like a source
    } else if (isSource(value)) {
        endpoint += value.trim() + '#*';
    // Otherwise use the key as the source
    } else {
        endpoint += key.trim() + '#' + split[0].trim();
    }

    return decompose(endpoint);
}

function decomposed2json(decEndpoint) {
    var error;
    var name = decEndpoint.name.trim();
    var source = decEndpoint.source.trim();
    var target = decEndpoint.target.trim();
    var value = '';
    var ret = {};

    if (!name) {
        error = new Error('Decomposed endpoint must have a name');
        error.code = 'EINVEND';
        throw error;
    }

    // Add source only if different than the name
    if  (source !== name) {
        value += source;
    }

    // If value is empty, we append the target always
    if (!value) {
        value += isWildcard(target) ? '*' : target;
    // Otherwise append only if not a wildcard
    } else if (!isWildcard(target)) {
        value += '#' + target;
    }

    ret[name] = value;

    return ret;
}

function isWildcard(target) {
    if (!target) {
        return true;
    }

    target = target.trim();

    return target === '*' || target === 'latest';
}

function isSource(value) {
    return (/[\/\\@]/).test(value);
}

module.exports.decompose = decompose;
module.exports.compose = compose;
module.exports.json2decomposed = json2decomposed;
module.exports.decomposed2json = decomposed2json;
