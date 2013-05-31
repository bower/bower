var mout = require('mout');

function rpad(Handlebars) {
    Handlebars.registerHelper('rpad', function (context) {
        var hash = context.hash;
        return mout.string.rpad(context.fn(this), hash.length, hash.char);
    });
}

module.exports = rpad;
