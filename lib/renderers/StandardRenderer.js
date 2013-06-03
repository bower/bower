require('colors');
var mout = require('mout');
var template = require('../util/template');

var wideCommands = ['install', 'update'];

function StandardRenderer(command, config) {
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
    this._config = config;

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

    str = this._prefix(err) + ' ' + err.message + '\n';

    // Check if additional details were provided
    if (err.details) {
        str += mout.string.trim(err.details) + '\n';
    }

    // Print stack if verbose or the error has no code
    // In some cases there's no stack (Maximum call stack exceeded errors)
    if (err.stack && (this._config.verbose || !err.code)) {
        str += '\n' + err.stack + '\n';
    }

    this._write(process.stderr, 'bower ' + str);
};

StandardRenderer.prototype.log = function (log) {
    var method = '_' + mout.string.camelCase(log.id) + 'Log';

    this._guessOrigin(log);

    // Call render method for this log entry or the generic one
    if (this[method]) {
        this[method](log);
    } else {
        this._genericLog(log);
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

StandardRenderer.prototype._genericLog = function (log) {
    var stream;
    var str;

    if (log.level === 'warn') {
        stream = process.stderr;
    } else {
        stream = process.stdout;
    }

    str = this._prefix(log) + ' ' + log.message + '\n';
    this._write(stream, 'bower ' + str);
};

StandardRenderer.prototype._mutualLog = function (log) {
    log.id = 'conflict';
    this._genericLog(log);
};

StandardRenderer.prototype._checkoutLog = function (log) {
    if (this._compact) {
        log.message = log.origin + '#' + log.message;
    }

    this._genericLog(log);
};

// -------------------------

StandardRenderer.prototype._guessOrigin = function (log) {
    if (log.data.endpoint) {
        log.origin = log.data.endpoint.name || (log.data.registry && log.data.endpoint.source);
    }

    if (!log.origin) {
        if (log.data.resolver) {
            log.origin = log.data.resolver.name;
        }
        else if (log.data.package) {
            log.origin = log.data.package;
        }
    }
};

StandardRenderer.prototype._prefix = function (log) {
    var label;
    var length;
    var nrSpaces;
    var id = log.id;
    var idColor = this._colors[log.level] || this._colors['default'];

    // If there's not enough space, print only the id
    if (this._compact) {
        return mout.string.rpad(id, this._sizes.id)[idColor];
    }

    // Construct the label
    if (log.origin && log.data.endpoint) {
        label = log.origin + '#' + log.data.endpoint.target;
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
    if (!this._config.color) {
        str = str.replace(/\x1B\[\d+m/g, '');
    }

    stream.write(str);
};

module.exports = StandardRenderer;
