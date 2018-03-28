var mout = require('mout');

function rpad(Handlebars) {
    Handlebars.registerHelper('rpad', function(context) {
        var hash = context.hash;
        var minLength = parseInt(hash.minLength, 10);
        var chr = hash.char;
        return mout.string.rpad(context.fn(this), minLength, chr);
    });
}

module.exports = rpad;
