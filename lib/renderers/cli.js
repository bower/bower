var mout = require('mout');

var paddings = {
    tag: 10,
    tagPlusLabel: 31
};

var tagColors = {
    'warn': 'yellow',
    'error': 'red',
    '_default': 'cyan',
};

function renderData(data) {
    // Ensure data
    data.data = data.data || '';

    return 'bower ' + renderTagPlusLabel(data) + ' ' + data.data + '\n';
}

function renderError(err) {
    var str;

    err.level = 'error';
    err.tag = err.code;

    str = 'bower ' + renderTagPlusLabel(err) + ' ' + err.message + '\n';

    // Check if additional details were provided
    if (err.details) {
        str += err.details + '\n';
    }

    // Print stack
    str += '\n' + err.stack + '\n';

    return str;
}

function renderEnd() {
    return '';
}

function renderCheckout(data) {
    if (isCompact()) {
        data.data = data.origin + '#' + data.data;
    }

    return renderData(data);
}

// -------------------------

function empty() {
    return '';
}

function uncolor(str) {
    return str.replace(/\x1B\[\d+m/g, '');
}

function isCompact() {
    return process.stdout.columns < 120;
}

function renderTagPlusLabel(data) {
    var label;
    var length;
    var nrSpaces;
    var tag = data.tag;
    var tagColor = tagColors[data.level] || tagColors._default;

    // If there's not enough space, print only the tag
    if (isCompact()) {
        return mout.string.rpad(tag, paddings.tag)[tagColor];
    }

    label = data.origin + '#' + data.endpoint.target;
    length = tag.length + label.length + 1;
    nrSpaces = paddings.tagPlusLabel - length;

    // Ensure at least one space
    if (nrSpaces < 1) {
        nrSpaces = 1;
    }

    return label.green + mout.string.repeat(' ', nrSpaces) + tag[tagColor];
}

// -------------------------

module.exports.colorful = {};
module.exports.colorful.head = empty;
module.exports.colorful.tail = empty;

module.exports.colorful.data = renderData;
module.exports.colorful.error = renderError;
module.exports.colorful.end = renderEnd;
module.exports.colorful.checkout = renderCheckout;

// The colorless variant simply removes the colors from the colorful methods
module.exports.colorless = mout.object.map(module.exports.colorful, function (fn) {
    return function () {
        var str = fn.apply(fn, arguments);
        return uncolor(str);
    };
});
