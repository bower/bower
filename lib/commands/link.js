var EventEmitter = require('events').EventEmitter;
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var mout = require('mout');
var Q = require('q');
var Project = require('../core/Project');
var Logger = require('../core/Logger');
var createError = require('../util/createError');
var cli = require('../util/cli');
var defaultConfig = require('../config');

function linkSelf(config) {
    var project;
    var emitter = new EventEmitter();
    var logger = new Logger();

    config = mout.object.deepMixIn(config || {}, defaultConfig);
    project = new Project(config, logger);

    project.getJson()
    .then(function (json) {
        var src = config.cwd;
        var dst = path.join(config.storage.links, json.name);

        // Delete previous link if any
        return Q.nfcall(rimraf, dst)
        // Link globally
        .then(function () {
            return createLink(src, dst);
        })
        .then(function () {
            emitter.emit('end', {
                src: src,
                dst: dst
            });
        });
    })
    .fail(function (error) {
        emitter.emit('error', error);
    });

    return logger.pipe(emitter);
}

function linkTo(name, localName, config) {
    var src;
    var dst;
    var emitter = new EventEmitter();

    config = mout.object.deepMixIn(config || {}, defaultConfig);

    localName = localName || name;
    src = path.join(config.storage.links, name);
    dst = path.join(process.cwd(), config.directory, localName);

    // Delete destination folder if any
    Q.nfcall(rimraf, dst)
    // Link locally
    .then(function () {
        return createLink(src, dst);
    })
    .then(function () {
        emitter.emit('end', {
            src: src,
            dst: dst
        });
    })
    .fail(function (error) {
        emitter.emit('error', error);
    });

    return emitter;
}

function createLink(src, dst) {
    var dstDir = path.dirname(dst);

    // Create directory
    return Q.nfcall(mkdirp, dstDir)
    // Check if source exists
    .then(function () {
        return Q.nfcall(fs.lstat, src)
        .fail(function (error) {
            if (error.code === 'ENOENT') {
                throw createError('Failed to create link to ' + path.basename(src), 'ENOENT', {
                    details: src + ' doest not exists or points to a non-existent package'
                });
            }

            throw error;
        });
    })
    // Create symlink
    .then(function () {
        return Q.nfcall(fs.symlink, src, dst, 'dir');
    });
}

// -------------------

var link = {};

link.line = function (argv) {
    var options = link.options(argv);
    var name = options.argv.remain[1];
    var localName = options.argv.remain[2];

    if (name) {
        return linkTo(name, localName);
    }

    return linkSelf();
};

link.options = function (argv) {
    return cli.readOptions(argv);
};

link.completion = function () {
    // TODO:
};

module.exports = link;
