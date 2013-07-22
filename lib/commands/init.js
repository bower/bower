var Logger = require('bower-logger');
var fs = require('graceful-fs');
var path = require('path');
var cli = require('../util/cli');
var Project = require('../core/Project.js');
var bowerJSON = require('bower-json');
var Q = require('q');
var inquirer = require('inquirer');

function init() {
    var logger = new Logger();

    var getExisting = function () {
        var deferred = Q.defer();
        var metadata = {
            filename: path.join(process.cwd(), 'bower.json'),
            options: {},
            answers: {}
        };

        bowerJSON.find(process.cwd(), function (err, foundFilename) {
            if (err) {
                return deferred.resolve(metadata);
            }

            metadata.filename = foundFilename;

            bowerJSON.read(foundFilename, function (err, json) {
                if (!err) {
                    metadata.options = json;
                }

                return deferred.resolve(metadata);
            });
        });

        return deferred.promise;
    };

    var setName = function (metadata) {
        if (!metadata.options.name) {
            metadata.options.name = path.basename(process.cwd());
        }

        return metadata;
    };

    var setVersion = function (metadata) {
        if (!metadata.options.version) {
            metadata.options.version = '0.0.0';
        }

        return metadata;
    };

    var setMain = function (metadata) {
        if (!metadata.options.main) {
            // Remove '.js' from the end of the package name if it is there
            var name = path.basename(metadata.options.name, '.js');

            if (fs.existsSync(path.join(process.cwd(), 'index.js'))) {
                metadata.options.main = 'index.js';
            } else if (fs.existsSync(path.join(process.cwd(), name + '.js'))) {
                metadata.options.main = name + '.js';
            }
        }

        return metadata;
    };

    var setIgnore = function (metadata) {
        if (metadata.answers.ignore) {
            if (!Array.isArray(metadata.options.ignore)) {
                metadata.options.ignore = [];
            }

            metadata.options.ignore = metadata.options.ignore
                .concat(['**/.*', 'node_modules', 'components', 'bower_components', 'test', 'tests'])
                .filter(function (item, index) {
                    return metadata.options.ignore.indexOf(item) === index;
                });
        }

        return metadata;
    };

    var setDependencies = function (metadata) {
        if (metadata.answers.dependencies) {
            var project = new Project();
            metadata.options.dependencies = {};

            return project.getTree()
                .then(function (tree) {
                    for (var key in tree[1]) {
                        var dep = tree[1][key];
                        metadata.options.dependencies[dep.name] = dep.source + '#' + dep.target;
                    }
                    return metadata;
                });
        } else {
            return metadata;
        }
    };

    var getUserResponse = function (metadata) {
        var deferred = Q.defer();

        var questions = [
            {
                'name': 'name',
                'message': 'name',
                'default': metadata.options.name,
                'type': 'input'
            },
            {
                'name': 'version',
                'message': 'version',
                'default': metadata.options.version,
                'type': 'input'
            },
            {
                'name': 'main',
                'message': 'main file',
                'default': metadata.options.main,
                'type': 'input'
            },
            {
                'name': 'dependencies',
                'message': 'set currently installed components as dependencies?',
                'default': metadata.options.dependencies && Object.keys(metadata.options.dependencies).length > 0,
                'type': 'confirm'
            },
            {
                'name': 'ignore',
                'message': 'add commonly ignored files to ignore list?',
                'default': true,
                'type': 'confirm'
            }
        ];

        inquirer.prompt(questions, function (answers) {
            metadata.options.name = answers.name;
            metadata.options.version = answers.version;
            metadata.options.main = answers.main;

            metadata.answers = answers;

            return deferred.resolve(metadata);
        });

        return deferred.promise;
    };

    var save = function (metadata) {
        console.log(metadata);
        return Q.nfcall(fs.writeFile, metadata.filename, JSON.stringify(metadata.options, null, 2));
    };

    // Start with existing JSON details
    getExisting()
        // Fill in blanks with a default set
        .then(setName)
        .then(setVersion)
        .then(setMain)
        // Now prompt user to make changes
        .then(getUserResponse)
        // If the user wanted to set ignore/dependencies, do that
        .then(setIgnore)
        .then(setDependencies)
        // All done!
        .then(save)
        .done();

    return logger;
}

// -------------------

init.line = function () {
    return init();
};

init.options = function (argv) {
    return cli.readOptions(argv);
};

init.completion = function () {
    // TODO:
};

module.exports = init;
