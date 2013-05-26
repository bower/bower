var mout = require('mout');

var colorful;
var colorless;
var sizes = {
    tag: 10,   // Tag max chars
    label: 23, // Label max chars
    sumup: 5   // Amount to sum when the label exceeds
};
var tagColors = {
    'warn': 'yellow',
    'error': 'red',
    'default': 'cyan'
};

function isCompact() {
    return process.stdout.columns < 120;
}

function uncolor(str) {
    return str.replace(/\x1B\[\d+m/g, '');
}

function renderTagPlusLabel(data) {
    var label;
    var length;
    var nrSpaces;
    var tag = data.tag;
    var tagColor = tagColors[data.level] || tagColors['default'];

    // If there's not enough space, print only the tag
    if (isCompact()) {
        return mout.string.rpad(tag, sizes.tag)[tagColor];
    }

    label = data.origin + '#' + data.endpoint.target;
    length = tag.length + label.length + 1;
    nrSpaces = sizes.tag + sizes.label - length;

    // Ensure at least one space between the label and the tag
    if (nrSpaces < 1) {
        sizes.label = label.length + sizes.sumup;
        nrSpaces = sizes.tag + sizes.label - length;
    }


    return label.green + mout.string.repeat(' ', nrSpaces) + tag[tagColor];
}

// -------------------------

colorful = {
    begin: function () {},
    end: function () {},
    error: function (err) {
        var str;

        err.tag = err.code || 'error';
        err.level = 'error';
        str = 'bower ' + renderTagPlusLabel(err) + ' ' + err.message + '\n';

        // Check if additional details were provided
        if (err.details) {
            str += err.details + '\n';
        }

        // Print stack
        str += '\n' + err.stack + '\n';

        this._write(process.stderr, str);
    },
    data: function (data) {
        var outputStream;

        data.data = data.data || '';
        outputStream = data.level === 'warn' ? process.stderr : process.stdout;

        this._write(outputStream, 'bower ' + renderTagPlusLabel(data) + ' ' + data.data + '\n');
    },
    checkout: function (data) {
        if (isCompact()) {
            data.data = data.origin + '#' + data.data;
        }

        this.data(data);
    },
    _write: function (outputStream, str) {
        outputStream.write(str);
    }
};

// The colorless variant simply removes the colors from the write method
colorless = mout.object.mixIn({}, colorful, {
    _write: function (outputStream, str) {
        outputStream.write(uncolor(str));
    }
});

module.exports.colorful = colorful;
module.exports.colorless = colorless;
