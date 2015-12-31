var which = require('which');

// Check if git is installed
function hasGit(){
    var checkGit;
    try {
        which.sync('git');
        checkGit = true;
    } catch (ex) {
        checkGit = false;
    }
    return checkGit;
}
module.exports = hasGit;
