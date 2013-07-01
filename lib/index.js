var abbrev = require('abbrev');
var mout = require('mout');
var commands = require('./commands');

var abbreviations;

function names(obj, prefix, stack) {
    prefix = prefix || '';
    stack = stack || [];

    mout.object.forOwn(obj, function (value, name) {
        name = prefix + name;

        stack.push(name);

        if (typeof value === 'object' && !value.line) {
            names(value, name + ' ', stack);
        }
    });

    return stack;
}

abbreviations = abbrev(names(commands));
abbreviations.i = 'install';
abbreviations.rm = 'uninstall';

module.exports = {
    commands: commands,
    config: require('./config'),
    abbreviations: abbreviations
};
