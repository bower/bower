// TODO: take care of trailing ,

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
    return uncolor(JSON.stringify(data, null, '  '));
}

// -------------------------

module.exports = {
    head: renderHead,
    tail: renderTail,
    data: renderData,
    error: renderError,
    end: renderEnd
};
