'use strict';
var bowerJson = require('bower-json');

function validateBowerJson(decEndpoint) {
    var options = {
        enforceNameExists: false,
        strictNames: false
    };
    bowerJson.validate(decEndpoint, options);
}

module.exports = validateBowerJson;
