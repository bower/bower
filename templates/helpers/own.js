var mout = require('mout');

function own(Handlebars) {
    Handlebars.registerHelper('own', function (obj, hash) {
        var str = '';

        mout.object.forOwn(obj, function (value, key) {
            str += hash.fn({
                key: key,
                value: value
            });
        });

        return str;
    });
}

module.exports = own;
