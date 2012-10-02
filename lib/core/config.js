// Bower Config

module.exports = function() {
	
  var c = require('rc') ('bower', {
    //Bower Defaults
    directory: 'components', 
    json:      'component.json',
    endpoint:  'https://bower.herokuapp.com',
    searchpath: []
  });

  // temp for now
  // rc doesn't read .bowerrc from local so we do it manually
  var fs = require('fs');
  if (fs.existsSync('.bowerrc')) {
	c = JSON.parse(fs.readFileSync('.bowerrc').toString());
  }

  return c;

}();
