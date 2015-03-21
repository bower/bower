var Q = require('q');


function LockFile(Project){
    this._project = Project;
}

LockFile.prototype.generate = function(){
    var that = this;

    console.log(that._project);

    return Q.resolve({});
};

module.exports = LockFile;
