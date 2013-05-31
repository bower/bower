var mout = require('mout');

function own(Handlebars) {
    Handlebars.registerHelper('own', function (obj, options) {
        var str = '';

        mout.object.forOwn(obj, function (value, key) {
            str += options.fn({
                key: key,
                value: value
            });
        });

        return str;
    });
}

module.exports = own;
