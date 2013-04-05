var util = require('util');
var fs = require('fs');
var path = require('path');
var events = require('events');
var mout = require('mout');
var Q = require('q');
var tmp = require('tmp');
var UnitOfWork = require('./UnitOfWork');
var config = require('./config');
var createPackage;
var createError = require('../util/createError');

var Package = function (endpoint, options) {
    options = options || {};

    this._endpoint = endpoint;
    this._name = options.name;
    this._explicitName = !!this.name;
    this._range = options.range || '*';
    this._unitOfWork = options.unitOfWork || new UnitOfWork();
};

util.inherits(Package, events.EventEmitter);

// -----------------

Package.prototype.getName = function () {
    return this._name;
};

Package.prototype.getEndpoint = function () {
    return this._endpoint;
};

Package.prototype.getRange = function () {
    return this._range;
};

Package.prototype.getTempDir = function () {
    return this._tempDir;
};

Package.prototype.resolve = function () {
    // Throw if already resolved
    if (this._resolved) {
        throw createError('Package is already resolved', 'EALREADYRES');
    }

    // 1st - Enqueue the package in the unit of work
    return this._unitOfWork.enqueue(this)
    .then(function (done) {
        // 2nd - Create temporary dir
        return this._createTempDir()
        // 3nd - Resolve self
        .then(this._resolveSelf.bind(this))
        // 4th - Read local rc
        .then(this._readRc.bind(this))
        // 5th - Read json
        .then(this._readJson.bind(this))
        // 6th - Parse json
        .then(this._parseJson.bind(this))
        // 7th - Mark as resolved & call done
        //       to inform the unit of work
        .then(function (dependencies) {
            this._resolved = true;
            done();
            return dependencies;
        }.bind(this), function (err) {
            this._resolveError = err;
            done();
            throw err;
        }.bind(this))
        // 8th - Resolve dependencies
        .then(this._resolveDependencies.bind(this));
    }.bind(this), function (err) {
        // If error is of a duplicate package,
        // copy everything from the resolved package (duplicate) to itself
        if (err.code === 'EDUPL') {
            mout.object.mixIn(this, err.pkg);
        } else {
            this._resolveError = err;
            throw err;
        }
    });
};

Package.prototype.getResolveError = function () {
    return this._resolveError;
};

Package.prototype.getJson = function () {
    this._assertResolved();
    return this._json;
};

Package.prototype.getDependencies = function () {
    this._assertResolved();
    return this._dependencies;
};

Package.prototype.install = function () {
    this._assertResolved();

    // TODO
};

// -----------------

Package.prototype._resolveSelf = function () {};

// -----------------


Package.prototype._createTempDir = function () {
    console.log('_createTempDir');

    // Resolved if cached
    if (this._tempDir) {
        return Q.fcall(this._tempDir);
    }

    return Q.nfcall(tmp.dir, {
        prefix: 'bower-' + this.name + '-',
        mode: parseInt('0777', 8) & (~process.umask())
    })
    .then(function (dir) {
        this._tempDir = dir;
        return dir;
    }.bind(this));
};

Package.prototype._readRc = function () {
    console.log('_readRc');

    // Resolved if cached
    if (this._rc) {
        return Q.fcall(this._rc);
    }

    var rcFile = path.join(this.getTempDir(), '.bowerrc');

    // 1nd - Read rc as string
    return Q.nfcall(fs.readFile, rcFile)
    // 2nd - If successfull, parse it as json
    //     - If the file does not exist, make it the global config
    .then(function (contents) {
        try {
            this._rc = JSON.parse(contents);
            return this._rc;
        } catch (e) {
            throw createError('Unable to parse local ".bowerrc" file', 'EINVJSON', {
                details: 'Unable to parse JSON file "' + rcFile + '": ' + e.message
            });
        }
    }.bind(this), function (err) {
        // If the file does not exist, return the global config
        if (err.code === 'ENOENT') {
            return config;
        }

        throw err;
    });
};

Package.prototype._readJson = function (rc) {
    console.log('_readJson');

    // Resolve if cached
    if (this._json) {
        return Q.fcall(this._json);
    }

    var jsonFile = path.join(this.getTempDir(), rc.json);

    // 1nd - Read json as string
    return Q.nfcall(fs.readFile, jsonFile)
    // 2nd - If successfull, parse and validate json
    //     - If the file does not exist, make it an empty object
    .then(function (contents) {
        return Q.fcall(function () {
            // TODO: change the read & validation to a separate package in the bower organization
            try {
                this._json = JSON.parse(contents);
                return this._json;
            } catch (e) {
                throw createError('Unable to parse local "' + this._rc.json + '" file', 'EINVJSON', {
                    details: 'Unable to parse JSON file "' + jsonFile + '": ' + e.message
                });
            }
        });
    }.bind(this), function (err) {
        // At this point, there was an error reading the file
        // Throw if the error code is not ENOENT
        if (err.code !== 'ENOENT') {
            throw err;
        }

        // If the json was already the component.json,
        // simply assume an empty one
        if (rc.json === 'component.json') {
            this._json = {};
            return this._json;
        }
        // Otherwise, if the json is equal to the project's config
        // try the standard 'component.json'
        if (rc.json === config.json) {
            return this._readJson(mout.object.mixIn(rc, { json: 'component.json' }));
        }
        // Otherwise, the json was a custom defined one at the package level
        // try the project's config one
        return this._readJson(mout.object.mixIn(rc, { json: config.json }));
    }.bind(this));
};

Package.prototype._parseJson = function (json) {
    console.log('_parseJson');

    // Resolve if cached
    if (this._dependencies) {
        return Q.fcall(this._dependencies);
    }

    // 1st - Check if name defined in the json is different
    //     Only handle it if the package name was not explicitly set
    if (!this._explicitName && json.name !== this.name) {
        this.name = json.name;
        this.emit('name_change', this.name);
    }

    // 2nd - Handle ignore property
    return Q.fcall(function () {
        // Delete all the files specified in the ignore from the temporary directory
        // TODO:
    }.bind(this))
    // 3rd - Handle the dependencies property
    .then(function () {
        var key,
            promises = [];

        // Read the dependencies, creating a package for each one
        createPackage = createPackage || require('./createPackage');
        if (json.dependencies) {
            for (key in json.dependencies) {
                promises.push(createPackage(json.dependencies[key], { name: key, unitOfWork: this._unitOfWork }));
            }
        }

        // Since the create package actually returns a promise, we must resolve them all
        return Q.all(promises).then(function (packages) {
            this._dependencies = packages;
            return packages;
        }.bind(this));
    });
};


Package.prototype._resolveDependencies = function (dependencies) {
    console.log('_resolveDependencies');

    var promises = dependencies.map(function (dep) {
        return dep.resolve();
    });

    return Q.all(promises);
};

Package.prototype._assertResolved = function () {
    if (!this._resolved) {
        throw createError('Package is not yet resolved', 'ENOTRES');
    }
};

module.exports = Package;