function uncolor(str) {
    return str.replace(/\x1B\[\d+m/g, '');
}

function stringify(data) {
    return uncolor(JSON.stringify(data, null, '  '));
}

// -------------------------

var nrData = 0;

// In the json output, everything goes to stderr except
// the final command result that goes to stdout.
var json = {
    begin: function () {
        process.stderr.write('[');
    },
    end: function (data) {
        process.stderr.write(']\n');

        if (data) {
            process.stdout.write(stringify(data));
        }
    },
    error: function (err) {
        this.data(err);
    },
    data: function (data) {
        if (nrData) {
            process.stderr.write(', ');
        }

        process.stderr.write(stringify(data));
        nrData++;
    },

};

module.exports = json;