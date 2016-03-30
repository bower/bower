var expect = require('expect.js');
var object = require('mout').object;

var helpers = require('../helpers');
var updateCmd = helpers.command('update');
var commands = helpers.require('lib/index').commands;

describe('bower update', function () {
    this.timeout(10000);

    var tempDir = new helpers.TempDir();

    var subPackage = new helpers.TempDir({
        'bower.json': {
            name: 'subPackage'
        }
    }).prepare();

    var gitPackage = new helpers.TempDir();

    gitPackage.prepareGit({
        '1.0.0': {
            'bower.json': {
                name: 'package'
            },
            'version.txt': '1.0.0'
        },
        '1.0.1': {
            'bower.json': {
                name: 'package',
                dependencies: {
                    subPackage: subPackage.path
                }
            },
            'version.txt': '1.0.1'
        }
    });

    var mainPackage = new helpers.TempDir({
        'bower.json': {
            name: 'package'
        }
    }).prepare();

    var updateLogger = function (packages, options, config) {
        config = object.merge(config || {}, {
            cwd: tempDir.path
        });

        return commands.update(packages, options, config);
    };

    var update = function (packages, options, config) {
        var logger = updateLogger(packages, options, config);

        return helpers.expectEvent(logger, 'end');
    };

    var install = function (packages, options, config) {
        config = object.merge(config || {}, {
            cwd: tempDir.path
        });

        var logger = commands.install(
            packages, options, config
        );

        return helpers.expectEvent(logger, 'end');
    };

    it('correctly reads arguments', function () {
        expect(updateCmd.readOptions(['jquery', '-F', '-p']))
        .to.eql([['jquery'], { forceLatest: true, production: true }]);
    });

    it('install missing packages', function () {
        mainPackage.prepare();

        tempDir.prepare({
            'bower.json': {
                name: 'test',
                dependencies: {
                    package: mainPackage.path
                }
            }
        });

        return update().then(function () {
            expect(tempDir.exists('bower_components/package/bower.json')).to.equal(true);
            expect(tempDir.read('bower_components/package/bower.json')).to.contain('"name": "package"');
        });
    });

    it('does not install ignored dependencies', function () {
        var package3 = new helpers.TempDir({
            'bower.json': {
                name: 'package3'
            }
        }).prepare();

        var package2 = new helpers.TempDir({
            'bower.json': {
                name: 'package2',
                dependencies: {
                    package3: package3.path
                }
            }
        }).prepare();

        tempDir.prepare({
            'bower.json': {
                name: 'test',
                dependencies: {
                    package2: package2.path
                }
            },
            '.bowerrc': {
                ignoredDependencies: ['package3']
            }
        });

        return update().then(function () {
            expect(tempDir.exists('bower_components/package2/bower.json')).to.equal(true);
            expect(tempDir.exists('bower_components/package3')).to.equal(false);
        });
    });

    it('does not install ignored dependencies if run multiple times', function () {
        var package3 = new helpers.TempDir({
            'bower.json': {
                name: 'package3'
            }
        }).prepare();

        var package2 = new helpers.TempDir({
            'bower.json': {
                name: 'package2',
                dependencies: {
                    package3: package3.path
                }
            }
        }).prepare();

        tempDir.prepare({
            'bower.json': {
                name: 'test',
                dependencies: {
                    package2: package2.path
                }
            },
            '.bowerrc': {
                ignoredDependencies: ['package3']
            }
        });

        return update().then(function () {
            return update().then(function () {
                expect(tempDir.exists('bower_components/package2/bower.json')).to.equal(true);
                expect(tempDir.exists('bower_components/package3')).to.equal(false);
            });
        });

    });

    it('runs preinstall hook when installing missing package', function () {
        mainPackage.prepare();

        tempDir.prepare({
            'bower.json': {
                name: 'test',
                dependencies: {
                    package: mainPackage.path
                }
            },
            '.bowerrc': {
                scripts: {
                    preinstall: 'node -e \'require("fs").writeFileSync("preinstall.txt", "%")\''
                }
            }
        });

        return update().then(function () {
            expect(tempDir.read('preinstall.txt')).to.be('package');
        });
    });

    it('runs postinstall hook when installing missing package', function () {
        mainPackage.prepare();

        tempDir.prepare({
            'bower.json': {
                name: 'test',
                dependencies: {
                    package: mainPackage.path
                }
            },
            '.bowerrc': {
                scripts: {
                    postinstall: 'node -e \'require("fs").writeFileSync("postinstall.txt", "%")\''
                }
            }
        });

        return update().then(function () {
            expect(tempDir.read('postinstall.txt')).to.be('package');
        });
    });

    it('doesn\'t runs postinstall when no package is update', function () {
        mainPackage.prepare();

        tempDir.prepare({
            'bower.json': {
                name: 'test',
                dependencies: {
                    package: mainPackage.path
                }
            },
            '.bowerrc': {
                scripts: {
                    postinstall: 'node -e \'require("fs").writeFileSync("postinstall.txt", "%")\''
                }
            }
        });

        return install().then(function () {
            tempDir.prepare();

            return update().then(function () {
                expect(tempDir.exists('postinstall.txt')).to.be(false);
            });
        });
    });

    it('updates a package', function () {
        tempDir.prepare({
            'bower.json': {
                name: 'test',
                dependencies: {
                    package: gitPackage.path + '#1.0.0'
                }
            }
        });

        return install().then(function () {

            expect(tempDir.read('bower_components/package/version.txt')).to.contain('1.0.0');

            tempDir.prepare({
                'bower.json': {
                    name: 'test',
                    dependencies: {
                        package: gitPackage.path + '#1.0.1'
                    }
                }
            });

            return update().then(function () {
                expect(tempDir.read('bower_components/package/version.txt')).to.contain('1.0.1');
            });
        });
    });

    it('does not install ignored dependencies when updating a package', function () {
        this.timeout(15000);

        var package3 = new helpers.TempDir({
            'bower.json': {
                name: 'package3'
            }
        }).prepare();

        var package2 = new helpers.TempDir().prepareGit({
            '1.0.0': {
                'bower.json': {
                    name: 'package2',
                    version: '1.0.0',
                    dependencies: {
                        package3: package3.path
                    }
                }
            },
            '1.0.1': {
                'bower.json': {
                    name: 'package2',
                    version: '1.0.1',
                    dependencies: {
                        package3: package3.path
                    }
                }
            }
        });

        tempDir.prepare({
            'bower.json': {
                name: 'test',
                dependencies: {
                    package2: package2.path + '#1.0.0'
                }
            },
            '.bowerrc': {
                ignoredDependencies: ['package3']
            }
        });

        return install().then(function () {

            expect(tempDir.readJson('bower_components/package2/bower.json').version).to.equal('1.0.0');
            expect(tempDir.exists('bower_components/package3')).to.equal(false);

            tempDir.prepare({
                'bower.json': {
                    name: 'test',
                    dependencies: {
                        package2: package2.path + '#1.0.1'
                    }
                },
                '.bowerrc': {
                    ignoredDependencies: ['package3']
                }
            });

            return update().then(function () {
                expect(tempDir.readJson('bower_components/package2/bower.json').version).to.equal('1.0.1');
                expect(tempDir.exists('bower_components/package3')).to.equal(false);
            });
        });
    });

    it('runs preinstall hook when updating a package', function () {
        tempDir.prepare({
            'bower.json': {
                name: 'test',
                dependencies: {
                    package: gitPackage.path + '#1.0.0'
                }
            }
        });

        return install().then(function () {
            tempDir.prepare({
                'bower.json': {
                    name: 'test',
                    dependencies: {
                        package: gitPackage.path + '#1.0.1'
                    }
                },
                '.bowerrc': {
                    scripts: {
                        preinstall: 'node -e \'require("fs").writeFileSync("preinstall.txt", "%")\''
                    }
                }
            });

            expect(tempDir.exists('preinstall.txt')).to.be(false);
            return update().then(function () {
                expect(tempDir.read('preinstall.txt')).to.be('subPackage package');
            });
        });
    });

    it('runs postinstall hook when updating a package', function () {
        tempDir.prepare({
            'bower.json': {
                name: 'test',
                dependencies: {
                    package: gitPackage.path + '#1.0.0'
                }
            }
        });

        return install().then(function () {
            tempDir.prepare({
                'bower.json': {
                    name: 'test',
                    dependencies: {
                        package: gitPackage.path + '#1.0.1'
                    }
                },
                '.bowerrc': {
                    scripts: {
                        preinstall: 'node -e \'require("fs").writeFileSync("preinstall.txt", "%")\'',
                        postinstall: 'node -e \'require("fs").writeFileSync("postinstall.txt", "%")\''
                    }
                }
            });

            expect(tempDir.exists('postinstall.txt')).to.be(false);
            return update().then(function () {
                expect(tempDir.read('postinstall.txt')).to.be('subPackage package');
            });
        });
    });
});
