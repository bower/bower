var path = require('path');
var bower = require('../../lib/index.js');
var mkdirp = require('mkdirp');
var rimraf = require('../../lib/util/rimraf');
var fs = require('../../lib/util/fs');
var expect = require('expect.js');
var scripts = require('../../lib/core/scripts.js');

describe('scripts', function () {

    var tempDir = path.join(__dirname, '../tmp/temp-scripts');
    var packageName = 'package-zip';
    var packageDir = path.join(__dirname, '../assets/' + packageName + '.zip');

    // We cannot use pure touch, because Windows
    var touch = function (file) {
        return 'node -e "var fs = require(\'fs\'); fs.closeSync(fs.openSync(\'' + file + '\', \'w\'));"';
    };

    // We cannot use pure touch, because Windows
    var touchWithPid = function (file) {
        return 'node -e "var fs = require(\'fs\'); fs.closeSync(fs.openSync(process.env.BOWER_PID + \'' + file + '\', \'w\'));"';
    };

    var config = {
        cwd: tempDir,
        scripts: {
            preinstall: touch('preinstall_%_%'),
            postinstall: touch('postinstall_%_%'),
            preuninstall: touch('preuninstall_%_%')
        }
    };

    before(function (next) {
        mkdirp(tempDir, next);
    });

    after(function (next) {
        rimraf(tempDir,  next);
    });

    it('should run preinstall and postinstall hooks.', function (next) {

        bower.commands
        .install([packageDir], undefined, config)
        .on('end', function (installed) {

            expect(fs.existsSync(path.join(tempDir, 'preinstall_' + packageName + '_' + packageName))).to.be(true);
            expect(fs.existsSync(path.join(tempDir, 'postinstall_' + packageName + '_' + packageName))).to.be(true);

            next();
        });

    });

    it('should run preuninstall hook.', function (next) {

        bower.commands
        .uninstall([packageName], undefined, config)
        .on('end', function (installed) {

            expect(fs.existsSync(path.join(tempDir, 'preuninstall_' + packageName + '_' + packageName))).to.be(true);

            next();
        });

    });

    it('should not break anything when no hooks configured.', function (next) {

        bower.commands
        .uninstall([packageName], undefined, { cwd: tempDir })
        .on('end', function (installed) {

            //no exception then we're good

            next();
        });

    });

    it('should reorder packages by dependencies, while trying to maintain order from bower.json, correctly.', function () {

        var mockAngularUI = { dependencies: {
            'angular': '*'
        }};
        var mockJQuery = { dependencies: {
        }};
        var mockAngular = { dependencies: {
            'jquery': '*'
        }};
        var mockMoment = { dependencies: {
        }};
        var mockSelect2 = { dependencies: {
            'jquery': '*'
        }};
        var mockBadPackage = { dependencies: {
            'something-not-installed': '*'
        }};

        var packages = {
            'select2': mockSelect2,
            'angular-ui': mockAngularUI,
            'jquery': mockJQuery,
            'bad-package': mockBadPackage,
            'angular': mockAngular,
            'moment': mockMoment
        };
        var installed = [];
        var mockBowerJson = { dependencies: {
            'jquery': '*',
            'select2': '*',
            'angular-ui': '*',
            'angular': '*',
            'moment': '*'
        } };

        var ordered = scripts._orderByDependencies(packages, installed, mockBowerJson);
        expect(ordered).to.eql(['jquery', 'select2', 'angular', 'angular-ui', 'moment', 'bad-package']);

    });

    it('should process scripts with quotes and vars in the cmd properly.', function (next) {

        config.scripts.preinstall = touchWithPid(' %');

        bower.commands
        .install([packageDir], undefined, config)
        .on('end', function (installed) {

            expect(fs.existsSync(path.join(tempDir, process.pid + ' ' + packageName))).to.be(true);

            next();
        });

    });

    it('should process preuninstall hooks with shell operators properly.', function (next) {

        config.scripts.preuninstall = touch('preuninstall_test_ping_%') + ' && ' + touch('preuninstall_test_pong');

        bower.commands
        .uninstall([packageName], undefined, config)
        .on('end', function (installed) {

            expect(fs.existsSync(path.join(tempDir, 'preuninstall_test_ping_' + packageName))).to.be(true);
            expect(fs.existsSync(path.join(tempDir, 'preuninstall_test_pong'))).to.be(true);

            next();
        });

    });

    it('should process preinstall and postinstall hooks with shell operators properly.', function (next) {

        config.scripts.preinstall = touch('preinstall_test_ping_%') + ' && ' + touch('preinstall_test_pong');
        config.scripts.postinstall = touch('postinstall_test_ping') + ' && ' + touch('postinstall_test_pong_%');

        bower.commands
        .install([packageDir], undefined, config)
        .on('end', function (installed) {

            expect(fs.existsSync(path.join(tempDir, 'preinstall_test_ping_' + packageName))).to.be(true);
            expect(fs.existsSync(path.join(tempDir, 'preinstall_test_pong'))).to.be(true);
            expect(fs.existsSync(path.join(tempDir, 'postinstall_test_ping'))).to.be(true);
            expect(fs.existsSync(path.join(tempDir, 'postinstall_test_pong_' + packageName))).to.be(true);

            next();
        });

    });

});
