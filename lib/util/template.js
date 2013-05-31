require('colors');
var Q = require('q');
var path = require('path');
var fs = require('fs');
var Handlebars = require('handlebars');
var mout = require('mout');
var helpers = require('../../templates/helpers');

var templatesDir = path.resolve(__dirname, '../../templates');
var cache = {};

// Register helpers
mout.object.forOwn(helpers, function (register) {
    register(Handlebars);
});

function template(name, data, escape) {
    var compiled = cache[name];
    var templatePath;

    // Check if already compiled
    // Note that the cache might contain promises so we resolve
    if (compiled) {
        return Q.resolve(compiled)
        .then(function (compiled) {
            return compiled(data);
        });
    }

    // Otherwise, read the file, compile and cache
    templatePath = path.join(templatesDir, name);
    compiled = cache[name] = Q.nfcall(fs.readFile, templatePath)
    .then(function (contents) {
        return cache[name] = Handlebars.compile(contents.toString(), {
            noEscape: !escape
        });
    });

    // Call the function again
    return compiled.then(function () {
        return template(name, data);
    });
}

module.exports = template;
