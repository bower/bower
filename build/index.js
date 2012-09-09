var request  = require('request');
var Hogan    = require('hogan.js');
var path     = require('path');
var markdown = require('markdown').markdown;
var fs       = require('fs');
// enable GitHub Flavored Markdown dialect
require('./gfm-dialect.js')
var url      = "https://raw.github.com/twitter/bower/master/README.md";
var template = Hogan.compile(fs.readFileSync(path.join(__dirname,'./template.{'), 'utf-8'));

request(url, function (error, response, body) {
  body = body.replace(/ \[\!\[Build Status\].+$/m, '')
  var bodyHTML = markdown.toHTML(body, 'GitHub');
  fs.writeFileSync(path.join(__dirname, '../index.html'), template.render({ body: bodyHTML }));
});