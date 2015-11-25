'use strict';
var bowerJson = require('bower-json');

function generateTemporaryPackageName() {
	return 'package';
}

function validateBowerJson(decEndpoint) {
    var options = {
        enforceNameExists: false,
        strictNames: false
    };
    if(!decEndpoint.name) {
    	decEndpoint.name = generateTemporaryPackageName();
    }
    bowerJson.validate(decEndpoint, options);
}

module.exports = validateBowerJson;
