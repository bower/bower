function forRead(options) {
    options = options || {};

    // Registry
    if (!options.registry) {
        options.registry = ['https://bower.herokuapp.com'];
    } else {
        if (!Array.isArray(options.registry)) {
            options.registry = [options.registry];
        }

        // Ensure that every registry does not end with /
        options.registry = options.registry.map(function (url) {
            return url.replace(/\/+$/, '');
        });
    }

    // Timeout
    if (typeof options.timeout !== 'number') {
        options.timeout = 5000;
    }

    return options;
}

function forWrite(options) {
    options = options || {};

    // Registry
    if (!options.registry) {
        options.registry = 'https://bower.herokuapp.com';
    } else {
        options.registry.replace(/\/+$/, '');
    }

    // TODO:

    return options;
}

module.exports.forRead = forRead;
module.exports.forWrite = forWrite;