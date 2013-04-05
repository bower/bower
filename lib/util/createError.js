var mout = require('mout');

function createError(msg, code, properties) {
    var err = new Error(msg);
    err.code = code;

    if (properties) {
        mout.object.mixIn(err, properties);
    }

    return err;
}

module.exports = createError;