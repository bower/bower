'use strict';

var endsWith = require('ends-with');
var extList = require('ext-list');
var sortKeysLength = require('sort-keys-length');

module.exports = function(str) {
    var obj = sortKeysLength.desc(extList());
    var ext = Object.keys(obj).filter(endsWith.bind(null, str));

    if (!ext.length) {
        return;
    }

    return {
        ext: ext[0],
        mime: obj[ext[0]]
    };
};
