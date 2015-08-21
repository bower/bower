var bowerJson = require('bower-json');

function validateBowerJson(decEndpoint) {
    var options = {
        enforceNameExists: false
    };
    bowerJson.validate(decEndpoint, options);
}

module.exports = validateBowerJson;
