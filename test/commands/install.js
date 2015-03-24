var expect = require('expect.js');
var helpers = require('../helpers');

describe('bower install', function () {

    var tempDir = new helpers.TempDir();

    var install = helpers.command('install', { cwd: tempDir.path });

    it('correctly reads arguments', function() {
        expect(install.readOptions(['jquery', 'angular', '-F', '-p', '-S', '-D', '-E']))
        .to.eql([['jquery', 'angular'], {
            forceLatest: true,
            production: true,
            save: true,
            saveDev: true,
            saveExact: true
        }]);
    });

    it('correctly reads long arguments', function() {
        expect(install.readOptions([
            'jquery', 'angular',
            '--force-latest', '--production', '--save', '--save-dev', '--save-exact'
        ])).to.eql([['jquery', 'angular'], {
            forceLatest: true,
            production: true,
            save: true,
            saveDev: true,
            saveExact: true
        }]);
    });

    var package = new helpers.TempDir({
        'bower.json': {
            name: 'package'
        }
    }).prepare();

    var gitPackage = new helpers.TempDir();

    var lockFile = {};

    it('writes to bower.json if --save flag is used', function () {
        package.prepare();

        tempDir.prepare({
            'bower.json': {
                name: 'test'
            }
        });

        return helpers.run(install, [[package.path], { save: true }]).then(function() {
            expect(tempDir.read('bower.json')).to.contain('dependencies');
        });
    });

    it('writes an exact version number to dependencies in bower.json if --save --save-exact flags are used', function () {
        package.prepare({
            'bower.json': {
                version: '1.2.3'
            }
        });

        tempDir.prepare({
            'bower.json': {
                name: 'test'
            }
        });

        return helpers.run(install, [
            [package.path],
            { saveExact: true, save: true }
        ]).then(function() {
            expect(tempDir.readJson('bower.json').dependencies.package).to.equal('1.2.3');
        });
    });

    it('writes an exact version number to devDependencies in bower.json if --save-dev --save-exact flags are used', function () {
        package.prepare({
            'bower.json': {
                version: '0.1.0'
            }
        });

        tempDir.prepare({
            'bower.json': {
                name: 'test'
            }
        });

        return helpers.run(install, [
            [package.path],
            { saveExact: true, saveDev: true }
        ]).then(function() {
            expect(tempDir.readJson('bower.json').devDependencies.package).to.equal('0.1.0');
        });
    });


    it('does not write to bower.json if only --save-exact flag is used', function() {
        package.prepare({
            'bower.json': {
                version: '1.2.3'
            }
        });

        tempDir.prepare({
            'bower.json': {
                name: 'test'
            }
        });

        return helpers.run(install, [[package.path], { saveExact: true }]).then(function() {
            expect(tempDir.read('bower.json')).to.not.contain('dependencies');
            expect(tempDir.read('bower.json')).to.not.contain('devDependencies');
        });
    });

    it('reads .bowerrc from cwd', function () {
        package.prepare({ foo: 'bar' });

        tempDir.prepare({
            '.bowerrc': { directory: 'assets' },
            'bower.json': {
                name: 'test',
                dependencies: {
                    package: package.path
                }
            }
        });

        return helpers.run(install).then(function() {
            expect(tempDir.read('assets/package/foo')).to.be('bar');
        });
    });

    it('runs preinstall hook', function () {
        package.prepare();

        tempDir.prepare({
            'bower.json': {
                name: 'test',
                dependencies: {
                    package: package.path
                }
            },
            '.bowerrc': {
                scripts: {
                    preinstall: 'node -e \'require("fs").writeFileSync("preinstall.txt", "%")\''
                }
            }
        });

        return helpers.run(install).then(function() {
            expect(tempDir.read('preinstall.txt')).to.be('package');
        });
    });

    it('runs preinstall hook', function () {
        package.prepare();

        tempDir.prepare({
            'bower.json': {
                name: 'test',
                dependencies: {
                    package: package.path
                }
            },
            '.bowerrc': {
                scripts: {
                    postinstall: 'node -e \'require("fs").writeFileSync("postinstall.txt", "%")\''
                }
            }
        });

        return helpers.run(install).then(function() {
            expect(tempDir.read('postinstall.txt')).to.be('package');
        });
    });

    // To be discussed, but that's the implementation now
    it('does not run hooks if nothing is installed', function () {
        tempDir.prepare({
            'bower.json': {
                name: 'test'
            },
            '.bowerrc': {
                scripts: {
                    postinstall: 'node -e \'require("fs").writeFileSync("hooks.txt", "%")\'',
                    preinstall: 'node -e \'require("fs").writeFileSync("hooks.txt", "%")\''
                }
            }
        });

        return helpers.run(install).then(function() {
            expect(tempDir.exists('hooks.txt')).to.be(false);
        });
    });

    it('runs postinstall after bower.json is written', function () {
        package.prepare();

        tempDir.prepare({
            'bower.json': {
                name: 'test'
            },
            '.bowerrc': {
                scripts: {
                    postinstall: 'node -e \'var fs = require("fs"); fs.writeFileSync("hook.txt", fs.readFileSync("bower.json"));\''
                }
            }
        });

        return helpers.run(install, [[package.path], { save: true }]).then(function() {
            expect(tempDir.read('hook.txt')).to.contain('dependencies');
        });
    });

    it('display the output of hook scripts', function (next) {
        package.prepare();

        tempDir.prepare({
            'bower.json': {
                name: 'test',
                dependencies: {
                    package: package.path
                }
            },
            '.bowerrc': {
                scripts: {
                    postinstall: 'node -e \'process.stdout.write("foobar")\''
                }
            }
        });

        var lastAction = null;

        helpers.run(install).logger.intercept(function (log) {
            if (log.level === 'action') {
                lastAction = log;
            }
        }).on('end', function () {
            expect(lastAction.message).to.be('foobar');
            next();
        });
    });

    it('works for git repositories', function () {
        return gitPackage.prepareGit({
            '1.0.0': {
                'bower.json': {
                    name: 'package'
                },
                'version.txt': '1.0.0'
            },
            '1.0.1': {
                'bower.json': {
                    name: 'package'
                },
                'version.txt': '1.0.1'
            }
        }).then(function() {
            tempDir.prepare({
                'bower.json': {
                    name: 'test',
                    dependencies: {
                        package: gitPackage.path + '#1.0.0'
                    }
                }
            });

            return helpers.run(install).then(function() {
                expect(tempDir.read('bower_components/package/version.txt')).to.contain('1.0.0');
            });
        });
    });

    it('generates a lockFile', function () {
        tempDir.prepare({
            'bower.json': {
                name: 'test',
                dependencies: {
                    packageGit: gitPackage.path + '#1.0.0'
                }
            }
        });

        return helpers.run(install).then(function() {
            var lockFileContents = tempDir.readJson('bower.lock');
            expect(lockFileContents).to.not.be(undefined);
            expect(lockFileContents).to.not.eql({});
            lockFile = lockFileContents;
        });
    });

    it('requires a lockFile when production', function (next) {
        tempDir.prepare({
            'bower.json': {
                name: 'test',
                dependencies: {
                    packageGit: gitPackage.path + '#1.0.0'
                }
            }
        });

        return helpers.run(install, [[], {production: true}]).then(function() {
            next(new Error('Error not thrown as expected'));
        }, function() {
            next();
        });
    });

    it('installs from lockFile when exists', function (next) {
        tempDir.prepare({
            'bower.json': {
                name: 'test',
                dependencies: {
                    packageGit: gitPackage.path + '#1.0.0'
                }
            },
            'bower.lock': lockFile
        });

        return helpers.run(install).then(function() {
            next();
        }, function() {
            next();
        });
    });

    it('error when tampering with version number', function (next) {
        tempDir.prepare({
            'bower.json': {
                name: 'test',
                dependencies: {
                    packageGit: gitPackage.path + '#1.0.1'
                }
            },
            'bower.lock': lockFile
        });

        return helpers.run(install).then(function() {
            next(new Error('Error not thrown as expected'));
        }, function() {
            next();
        });
    });

    it('new dependencies added in bower.json are installed', function () {
        package.prepare();

        tempDir.prepare({
            'bower.json': {
                name: 'test',
                dependencies: {
                    packageGit: gitPackage.path + '#1.0.0',
                    package: '0.1.1'
                }
            },
            'bower.lock': lockFile
        });

        return helpers.run(install).then(function() {
            expect(tempDir.read('bower_components/package/bower.json')).to.contain('"version": "0.1.1"');
            var lockFileContents = tempDir.read('bower.lock');
            expect(lockFileContents).to.contain('"package"');
            expect(lockFileContents).to.contain('"_release": "0.1.1"');
            lockFile = JSON.parse(lockFileContents);
        });
    });

    it('should install from lock file', function () {
        package.prepare();

        // Modify the lock file to match
        // test bower.json to test that
        // even though a newer version is available
        // the lock file is installing what it has
        lockFile.dependencies.package.endpoint.target = '~0.1.0';

        tempDir.prepare({
            'bower.json': {
                name: 'test',
                dependencies: {
                    packageGit: gitPackage.path + '#1.0.0',
                    package: '~0.1.0'
                }
            },
            'bower.lock': lockFile
        });

        return helpers.run(install).then(function() {
            expect(tempDir.read('bower_components/package/bower.json')).to.contain('"version": "0.1.1"');
            expect(tempDir.read('bower.lock')).to.contain('"package"');
            expect(tempDir.read('bower.lock')).to.contain('"_release": "0.1.1"');
        });
    });

    it('should install package when specifying package but not be in lockFile', function () {
        tempDir.prepare({
            'bower.json': {
                name: 'test',
                dependencies: {
                    packageGit: gitPackage.path + '#1.0.0',
                    package: '~0.1.0'
                }
            },
            'bower.lock': lockFile
        });

        return helpers.run(install, [['angular']]).then(function() {
            expect(tempDir.read('bower_components/angular/bower.json')).to.contain('"version": "1.3.15"');
            expect(tempDir.read('bower.lock')).to.not.contain('"angular"');
        });
    });

    var bowerJson = null;

    it('should install package when specifying package and be in lockFile with save argument', function () {
        tempDir.prepare({
            'bower.json': {
                name: 'test',
                dependencies: {
                    packageGit: gitPackage.path + '#1.0.0',
                    package: '~0.1.0'
                }
            },
            'bower.lock': lockFile
        });

        return helpers.run(install, [['angular'], {save: true}]).then(function() {
            expect(tempDir.read('bower_components/angular/bower.json')).to.contain('"version": "1.3.15"');
            expect(tempDir.read('bower.lock')).to.contain('"angular"');
            expect(tempDir.read('bower.json')).to.contain('"angular"');
            bowerJson = tempDir.readJson('bower.json');
            lockFile = tempDir.readJson('bower.lock');
        });
    });

    it('should install package when specifying package and be in lockFile with save-dev argument', function () {
        tempDir.prepare({
            'bower.json': bowerJson,
            'bower.lock': lockFile
        });

        return helpers.run(install, [['jquery'], {saveDev: true}]).then(function() {
            expect(tempDir.read('bower.lock')).to.contain('"jquery"');
            bowerJson = tempDir.readJson('bower.json');
            lockFile = tempDir.readJson('bower.lock');
        });
    });

    it('should install dev and non-dev dependencies from lockfile', function () {
        // Need a new tempDir to validate this
        tempDir = new helpers.TempDir();
        install = helpers.command('install', { cwd: tempDir.path });

        tempDir.prepare({
            'bower.json': bowerJson,
            'bower.lock': lockFile
        });

        return helpers.run(install).then(function() {
            expect(tempDir.exists('bower_components/angular/bower.json')).to.equal(true);
            expect(tempDir.exists('bower_components/jquery/bower.json')).to.equal(true);
        });
    });

    it('should install dev dependencies only from lockfile when using production flag', function () {
        // Need a new tempDir to validate this
        tempDir = new helpers.TempDir();
        install = helpers.command('install', { cwd: tempDir.path });

        tempDir.prepare({
            'bower.json': bowerJson,
            'bower.lock': lockFile
        });

        return helpers.run(install, [[], {production: true}]).then(function() {
            expect(tempDir.exists('bower_components/angular/bower.json')).to.equal(true);
            expect(tempDir.exists('bower_components/jquery/bower.json')).to.equal(false);
        });
    });
});
