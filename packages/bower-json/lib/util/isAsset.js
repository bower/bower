var extName = require('../vendor/ext-name');

function isAsset(filename) {
    var info = extName(filename);

    return (
        info &&
        info.mime &&
        (/^((image)|(audio)|(video)|(font))\//.test(info.mime) ||
            /application\/((x[-]font[-])|(font[-]woff(\d?))|(vnd[.]ms[-]fontobject))/.test(
                info.mime
            ))
    );
}

module.exports = isAsset;
