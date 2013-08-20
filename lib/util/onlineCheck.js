var request = require('request');
var Q = require('q');

// Does a quick check if it receives a status code; no responses map to 444
function onlineCheck(config) {
    var deferred = Q.defer();
    var url = (config && config.checkUrl) ? config.checkUrl : 'http://google.com';
    request.head(url, function (error, response) {
        var status = (response && response.statusCode) ? response.statusCode : 444;
        if (config && config.showStatus) {
            return deferred.resolve(status);
        }
        else if (status === 200) {
            return deferred.resolve(true);          
        }
        else {
            return deferred.resolve(false);
        }
    });
    return deferred.promise;
}

module.exports = onlineCheck;