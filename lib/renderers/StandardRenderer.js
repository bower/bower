require('colors');
var mout = require('mout');
var template = require('../util/template');

var wideCommands = ['install', 'update'];

function StandardRenderer(command, colorful) {
    this._sizes = {
        id: 10,    // Id max chars
        label: 23, // Label max chars
        sumup: 5   // Amount to sum when the label exceeds
    };
    this._colors = {
        warn: 'yellow',
        error: 'red',
        conflict: 'magenta',
        'default': 'cyan'
    };

    this._command = command;
    this._colorful = colorful == null ? true : colorful;

    if (wideCommands.indexOf(command) === -1) {
        this._compact = true;
    } else {
        this._compact = process.stdout.columns < 120;
    }
}

StandardRenderer.prototype.end = function (data) {
    var method = '_' + this._command;

    if (this[method]) {
        this[method](data);
    }
};

StandardRenderer.prototype.error = function (err) {
    var str;

    err.id = err.code || 'error';
    err.level = 'error';

    str = this._prefixNotification(err) + ' ' + err.message + '\n';

    // Check if additional details were provided
    if (err.details) {
        str += mout.string.trim(err.details) + '\n';
    }

    // Print stack if the error is not skippable
    if (!err.skippable) {
        str += '\n' + err.stack + '\n';
    }

    this._write(process.stderr, 'bower ' + str);
};

StandardRenderer.prototype.notification = function (notification) {
    var method = '_' + mout.string.camelCase(notification.id) + 'Notification';

    if (this[method]) {
        this[method](notification);
    } else {
        this._genericNotification(notification);
    }
};

StandardRenderer.prototype.updateNotice = function (data) {
    template('std/update-notice.std', data)
    .then(function (str) {
        this._write(process.stderr, str);
    }.bind(this), this.error.bind(this));
};

// -------------------------

StandardRenderer.prototype._install = function (installed) {
    // TODO: render tree of installed packages
};

StandardRenderer.prototype._update = function (updated) {
    // TODO: render tree of updated packages
};

StandardRenderer.prototype._help = function (data) {
    var that = this;

    if (!data.command) {
        template('std/help.std', data)
        .then(function (str) {
            that._write(process.stdout, str);
        }, this.error.bind(this));
    } else {
        // Try to render the help template for this command
        template('std/help-' + data.command + '.std', data)
        .then(function (str) {
            that._write(process.stdout, str);
        }, function (err) {
            // If it failed with something else than ENOENT
            // error out
            if (err.code !== 'ENOENT') {
                return err;
            }

            // Otherwise the template does not exist,
            // so render the generic one
            return template('std/help-generic.std', data)
            .then(function (str) {
                that._write(process.stdout, str);
            }, that.error.bind(that));
        });
    }
};

// -------------------------

StandardRenderer.prototype._genericNotification = function (notification) {
    var stream;
    var str;

    if (notification.level === 'warn') {
        stream = process.stderr;
    } else {
        stream = process.stdout;
    }

    str = this._prefixNotification(notification) + ' ' + notification.message + '\n';
    this._write(stream, 'bower ' + str);
};

StandardRenderer.prototype._mutualNotification = function (notification) {
    notification.id = 'conflict';
    this._genericNotification(notification);
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
        label = notification.from + '#' + notification.data.endpoint.target;
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
