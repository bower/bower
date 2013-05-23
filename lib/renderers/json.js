var circularJson = require('circular-json');

function renderHead() {
    return '[';
}

function renderTail() {
    return ']\n';
}

function renderData(data) {
    return stringify(data) + ', ';
}

function renderError(err) {
    return stringify(err) + ', ';
}

function renderEnd(data) {
    return data ? stringify(data) : '';
}

// -------------------------

function uncolor(str) {
    return str.replace(/\x1B\[\d+m/g, '');
}

function stringify(data) {
    return uncolor(circularJson.stringify(data, null, '  '));
}

module.exports.head = renderHead;
module.exports.tail = renderTail;

module.exports.data = renderData;
module.exports.error = renderError;
module.exports.end = renderEnd;