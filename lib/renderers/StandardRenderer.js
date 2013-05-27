var mout = require('mout');

function StandardRenderer(colorful) {
    this._sizes = {
        id: 10,    // Id max chars
        label: 23, // Label max chars
        sumup: 5   // Amount to sum when the label exceeds
    };
    this._colors = {
        warn: 'yellow',
        error: 'red',
        'default': 'cyan'
    };

    this._colorful = colorful == null ? true : colorful;
    this._compact = process.stdout.columns < 120;
}

StandardRenderer.prototype.end = function () {};

StandardRenderer.prototype.error = function (err) {
    var str;

    err.id = err.code || 'error';
    err.level = 'error';
    str = this._prefix(err) + ' ' + err.message + '\n';

    // Check if additional details were provided
    if (err.details) {
        str += mout.string.trim(err.details) + '\n';
    }

    // Print stack
    str += '\n' + err.stack + '\n';

    this._write(process.stderr, 'bower ' + str);
};

StandardRenderer.prototype.notification = function (notification) {
    var name = '_' + mout.string.camelCase(notification.id) + 'Notification';

    if (this[name]) {
        this[name](notification);
    } else {
        this._genericNotification(notification);
    }
};

// -------------------------

StandardRenderer.prototype.install = function (installed) {
    // TODO
};

StandardRenderer.prototype.help = function (command) {
    // TODO
};

StandardRenderer.prototype.updateAvailable = function (update) {
    // TODO
};

// -------------------------


StandardRenderer.prototype._genericNotification = function (notification) {
    var stream;
    var str;

    notification.message = notification.message || '';
    stream = notification.level === 'warn' ? process.stderr : process.stdout;
    str = this._prefixNotification(notification) + ' ' + notification.message + '\n';

    this._write(stream, 'bower ' + str);
};

StandardRenderer.prototype._checkoutNotification = function (notification) {
    if (this._compact) {
        notification.message = notification.from + '#' + notification.message;
    }

    this._genericNotification(notification);
};

// -------------------------

StandardRenderer.prototype._prefixNotification = function (notification) {
    var label;
    var length;
    var nrSpaces;
    var id = notification.id;
    var idColor = this._colors[notification.level] || this._colors['default'];

    // If there's not enough space, print only the id
    if (this._compact) {
        return mout.string.rpad(id, this._sizes.id)[idColor];
    }

    // Construct the label
    if (notification.from && notification.data.endpoint) {
        label = notification.from ? notification.from + '#' + notification.data.endpoint.target : '';
    // Make it empty if there's not enough information
    } else {
        label = '';
    }

    length = id.length + label.length + 1;
    nrSpaces = this._sizes.id + this._sizes.label - length;

    // Ensure at least one space between the label and the id
    if (nrSpaces < 1) {
        this._sizes.label = label.length + this._sizes.sumup;
        nrSpaces = this._sizes.id + this._sizes.label - length;
    }

    return label.green + mout.string.repeat(' ', nrSpaces) + id[idColor];
};

StandardRenderer.prototype._write = function (stream, str) {
    if (!this._colorful) {
        str = str.replace(/\x1B\[\d+m/g, '');
    }

    stream.write(str);
};

module.exports = StandardRenderer;
