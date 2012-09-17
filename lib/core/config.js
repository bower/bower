/**
 * We use the awesome rc library at https://github.com/dominictarr/rc 
 */
var rc = require('rc') ('bower', {
    //Bower Defaults
    directory: 'components', 
    json:      'component.json',
    endpoint:  'https://bower.herokuapp.com'
  });


/**
 * This function returns the Bower Config.
 */

module.exports = function() {
    return rc;
};