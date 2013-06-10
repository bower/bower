require('colors');
var mout = require('mout');
var template = require('../util/template');

function StandardRenderer(command, config) {
    this._sizes = {
        id: 13,    // Id max chars
        label: 20, // Label max chars
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

    if (this.constructor._wideCommands.indexOf(command) === -1) {
        this._compact = true;
    } else {
        this._compact = process.stdout.columns < 120;
    }
}

StandardRenderer.prototype.end = function (data) {
    var method = '_' + mout.string.camelCase(this._command);

    if (this[method]) {
        this[method](data);
    }
};

StandardRenderer.prototype.error = function (err) {
    var str;

    this._guessOrigin(err);

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
    var str = template.render('std/update-notice.std', data);
    this._write(process.stderr, str);
};

// -------------------------

StandardRenderer.prototype._help = function (data) {
    var str;
    var that = this;
    var specific;

    if (!data.command) {
        str = template.render('std/help.std', data);
        that._write(process.stdout, str);
    } else {
        // Check if a specific template exists for the command
        specific = 'std/help-' + data.command.replace(/\s+/g, '/') + '.std';

        if (template.exists(specific)) {
            str = template.render(specific, data);
        } else {
            str =  template.render('std/help-generic.std', data);
        }

        that._write(process.stdout, str);
    }
};

StandardRenderer.prototype._cacheList = function (entries) {
    entries.forEach(function (pkgMeta) {
        this.log({
            level: 'info',
            id: 'cached-entry',
            message: pkgMeta._source + (pkgMeta._release ? '#' + pkgMeta._release : ''),
            data: {
                name: pkgMeta.name,
                version: pkgMeta.version
            }
        });
    }, this);
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

StandardRenderer.prototype._checkoutLog = function (log) {
    if (this._compact) {
        log.message = log.origin.split('#')[0] + '#' + log.message;
    }

    this._genericLog(log);
};

StandardRenderer.prototype._incompatibleLog = function (log) {
    var str;
    var templatePath;

    // Generate dependants string for each pick
    log.data.picks.forEach(function (pick) {
        pick.dependants = pick.dependants.map(function (dependant) {
            var release = dependant.pkgMeta._release;
            return dependant.endpoint.name + (release ? '#' + release : '');
        }).join(', ');
    });

    templatePath = log.data.resolution ? 'std/conflict-resolved.std' : 'std/conflict.std';
    str = template.render(templatePath, log.data);

    this._write(process.stdout, '\n');
    this._write(process.stdout, str);
    this._write(process.stdout, '\n');
};

StandardRenderer.prototype._solvedLog = function (log) {
    this._incompatibleLog(log);
};

StandardRenderer.prototype._cachedEntryLog = function (log) {
    if (this._compact) {
        log.message = log.origin;
    }

    this._genericLog(log);
};

// -------------------------

StandardRenderer.prototype._guessOrigin = function (log) {
    if (log.data.endpoint) {
        log.origin = log.data.endpoint.name || (log.data.registry && log.data.endpoint.source);

        // Resort to using the resolver name for unnamed endpoints
        if (!log.origin && log.data.resolver) {
            log.origin = log.data.resolver.name;
        }

        if (log.data.endpoint.target) {
            log.origin += '#' + log.data.endpoint.target;
        }
    } else if (log.data.name) {
        log.origin = log.data.name;

        if (log.data.version) {
            log.origin += '#' + log.data.version;
        }
    }
};

StandardRenderer.prototype._prefix = function (log) {
    var label;
    var length;
    var nrSpaces;
    var id = this.constructor._idMappings[log.id] || log.id;
    var idColor = this._colors[log.level] || this._colors['default'];

    if (this._compact) {
        // If there's not enough space for the id, adjust it
        // for subsequent logs
        if (id.length > this._sizes.id) {
            this._sizes.id = id.length += this._sizes.sumup;
        }

        return mout.string.rpad(id, this._sizes.id)[idColor];
    }

    // Construct the label
    label = log.origin || '';
    length = id.length + label.length + 1;
    nrSpaces = this._sizes.id + this._sizes.label - length;

    // Ensure at least one space between the label and the id
    if (nrSpaces < 1) {
        // Also adjust the label size for subsequent logs
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

StandardRenderer._wideCommands = [
    'install',
    'update',
    'cache clean',
    'cache list'
];
StandardRenderer._idMappings = {
    'mutual': 'conflict',
    'cached-entry': 'cached'
};

module.exports = StandardRenderer;
