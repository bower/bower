function JsonRenderer() {
    this._nrLogs = 0;
}

JsonRenderer.prototype.end = function (data) {
    if (this._nrLogs) {
        process.stderr.write(']\n');
    }

    if (data) {
        process.stdout.write(this._stringify(data) + '\n');
    }
};

JsonRenderer.prototype.error = function (err) {
    err.id = err.code || 'error';
    err.level = 'error';

    this.log(err);
    this.end();
};

JsonRenderer.prototype.log = function (log) {
    if (!this._nrLogs) {
        process.stderr.write('[');
    } else {
        process.stderr.write(', ');
    }

    process.stderr.write(this._stringify(log));
    this._nrLogs++;
};

JsonRenderer.prototype.updateAvailable = function () {};

// -------------------------

JsonRenderer.prototype._stringify = function (log) {
    // To json
    var str = JSON.stringify(log, null, '  ');
    // Remove colors in case some log has colors..
    str = str.replace(/\x1B\[\d+m/g, '');

    return str;
};

module.exports = JsonRenderer;
