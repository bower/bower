var cli = require('../util/cli');
var createError = require('../util/createError');
var Logger = require('bower-logger');
var findup = require('findup-sync');
var path = require('path');
var fs = require('fs');
var zlib = require('zlib');
var os = require('os');
var fstreamIgnore = require('fstream-ignore');
var tar = require('tar');
var semver = require('semver');
var Q = require('q');

var createArchive = function (dir, logger) {
    var deferred = Q.defer();

    process.nextTick(function () {

        var cwd = process.cwd();
        if (dir) {
            cwd = path.resolve(cwd, dir);
            if (!fs.existsSync(cwd) || !fs.lstatSync(cwd).isDirectory()) {
                logger.emit('error', createError('Invalid directory specified.', 'EINVDIR'));
                deferred.reject();
                return;
            }
        }

        var bowerjson = findup('bower.json', {cwd: cwd});
        if (!bowerjson) {
            logger.emit('error', createError('Cannot find bower.json.', 'ECONFIGNOTFOUND'));
            deferred.reject();
            return;
        }

        var baseDir = path.dirname(bowerjson);
        var config = require(bowerjson);

        if (!config.name) {
            logger.emit('error', createError('Name must be specified in bower.json.', 'EINVNAME'));
            deferred.reject();
            return;
        }

        if (!semver.valid(config.version)) {
            logger.emit('error', createError('Version is either missing or invalid in bower.json.', 'EINVVER'));
            deferred.reject();
            return;
        }

        if (!config.ignore) {
            logger.emit('error', createError('Ignore property is missing in bower.json.  This property is required ' +
                'to publish a package. https://github.com/bower/bower.json-spec#ignore', 'EINVIGNORE'));
            deferred.reject();
            return;
        }

        var outputFile = path.join(os.tmpdir(), config.name + '-' + config.version + '.tgz');

        if (fs.existsSync(outputFile)) {
            fs.unlinkSync(outputFile);
        }

        var reader = fstreamIgnore({ path: baseDir, ignoreFiles: []});

        if (config.ignore) {
            reader.addIgnoreRules(config.ignore);
        }

        reader.pipe(tar.Pack())
            .pipe(zlib.Gzip())
            .pipe(fs.createWriteStream(outputFile));

        reader.on('end', function () {
            deferred.resolve(outputFile);
        });

    });

    return deferred.promise;
};

var publish = function (dir) {
    var logger = new Logger();

    createArchive(dir, logger)
        .then(function (archive) {

            //do upload

            var data = { file: archive };
            logger.emit('end', data);
        })
        .done();

    return logger;
};

publish.line = function (argv) {
    var options = publish.options(argv);
    var dir = options.argv.remain[1];

    return publish(dir);
};

publish.options = function (argv) {
    return cli.readOptions(argv);
};

publish.completion = function () {
    // TODO:
};

//expose for testing only
publish._createArchive = createArchive;

module.exports = publish;