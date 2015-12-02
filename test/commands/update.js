var expect = require('expect.js');
var object = require('mout').object;
var semver = require('semver');

var helpers = require('../helpers');
var rimraf = require('../../lib/util/rimraf');
var updateCmd = helpers.command('update');
var commands = helpers.require('lib/index').commands;

describe('bower update', function() {

    var tempDir = new helpers.TempDir();

    var subPackage = new helpers.TempDir({
        'bower.json': {
            name: 'subPackage'
        }
    }).prepare();

    var gitPackage = new helpers.TempDir();
    var gitPackage2 = new helpers.TempDir();
    var gitPackage3 = new helpers.TempDir();

    gitPackage.prepareGit({
        '0.1.1': {
            'bower.json': {
                name: 'package'
            },
            'version.txt': '0.9.0'
        },
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

    gitPackage2.prepareGit({
        '2.0.0': {
            'bower.json': {
                name: 'package'
            },
            'version.txt': '2.0.0'
        },
        '2.0.1': {
            'bower.json': {
                name: 'package'
            },
            'version.txt': '2.0.1'
        }
    });

    gitPackage3.prepareGit({
        '3.0.0': {
            'bower.json': {
                name: 'package'
            },
            'version.txt': '3.0.0'
        },
        '3.0.1': {
            'bower.json': {
                name: 'package'
            },
            'version.txt': '3.0.1'
        }
    });

    var mainPackage = new helpers.TempDir({
        'bower.json': {
            name: 'package'
        }
    }).prepare();

    var update = function(packages, options, config) {
        config = object.merge(config || {}, {
            cwd: tempDir.path
        });

        var logger = commands.update(
            packages, options, config
        );

        return helpers.expectEvent(logger, 'end');
    };

    var install = function(packages, options, config) {
        config = object.merge(config || {}, {
            cwd: tempDir.path
        });

        var logger = commands.install(
            packages, options, config
        );

        return helpers.expectEvent(logger, 'end');
    };

    it('correctly reads arguments', function() {
        expect(updateCmd.readOptions(['jquery', '-F', '-p', '-S', '-D']))
            .to.eql([
                ['jquery'], {
                    forceLatest: true,
                    production: true,
                    save: true,
                    saveDev: true
                }
            ]);
    });

    it('install missing packages', function() {
        mainPackage.prepare();

        tempDir.prepare({
            'bower.json': {
                name: 'test',
                dependencies: {
                    package: mainPackage.path
                }
            }
        });

        return update().then(function() {
            expect(tempDir.exists('bower_components/package/bower.json')).to.equal(true);
            expect(tempDir.read('bower_components/package/bower.json')).to.contain('"name": "package"');
        });
    });

    it('does not install ignored dependencies', function() {
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

        return update().then(function() {
            expect(tempDir.exists('bower_components/package2/bower.json')).to.equal(true);
            expect(tempDir.exists('bower_components/package3')).to.equal(false);
        });
    });

    it('does not install ignored dependencies if run multiple times', function() {
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

        return update().then(function() {
            return update().then(function() {
                expect(tempDir.exists('bower_components/package2/bower.json')).to.equal(true);
                expect(tempDir.exists('bower_components/package3')).to.equal(false);
            });
        });

    });

    it('runs preinstall hook when installing missing package', function() {
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

        return update().then(function() {
            expect(tempDir.read('preinstall.txt')).to.be('package');
        });
    });

    it('runs postinstall hook when installing missing package', function() {
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

        return update().then(function() {
            expect(tempDir.read('postinstall.txt')).to.be('package');
        });
    });

    it('doesn\'t runs postinstall when no package is update', function() {
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

        return install().then(function() {
            tempDir.prepare();

            return update().then(function() {
                expect(tempDir.exists('postinstall.txt')).to.be(false);
            });
        });
    });

    it('updates a package', function() {
        tempDir.prepare({
            'bower.json': {
                name: 'test',
                dependencies: {
                    package: gitPackage.path + '#1.0.0'
                }
            }
        });

        return install().then(function() {

            expect(tempDir.read('bower_components/package/version.txt')).to.contain('1.0.0');

            tempDir.prepare({
                'bower.json': {
                    name: 'test',
                    dependencies: {
                        package: gitPackage.path + '#1.0.1'
                    }
                }
            });

            return update().then(function() {
                expect(tempDir.read('bower_components/package/version.txt')).to.contain('1.0.1');
            });
        });
    });

    it('updates only the specified packages', function() {
        var package4 = new helpers.TempDir({
            'bower.json': {
                name: 'package4'
            }
        }).prepare();

        var package3 = new helpers.TempDir({
            'bower.json': {
                name: 'package3'
            }
        }).prepare();

        var package2 = new helpers.TempDir({
            'bower.json': {
                name: 'package2'
            }
        }).prepare();

        tempDir.prepare({
            'bower.json': {
                name: 'test',
                dependencies: {
                    package2: package2.path,
                    package3: package3.path,
                    package4: package4.path
                }
            }
        });

        return install().then(function() {

            rimraf.sync(tempDir.path + '/bower_components/');

            return update(['package4']).then(function() {
                expect(tempDir.exists('bower_components/package2')).to.equal(false);
                expect(tempDir.exists('bower_components/package3')).to.equal(false);
                expect(tempDir.exists('bower_components/package4/bower.json')).to.equal(true);

                rimraf.sync(tempDir.path + '/bower_components/');

                return update(['package2', 'package3']).then(function() {
                    expect(tempDir.exists('bower_components/package2/bower.json')).to.equal(true);
                    expect(tempDir.exists('bower_components/package3/bower.json')).to.equal(true);
                    expect(tempDir.exists('bower_components/package4')).to.equal(false);
                });
            });
        });
    });

    it('updates sub deps of only the specified packages', function() {
        var package3 = new helpers.TempDir({
            'bower.json': {
                name: 'package3',
                dependencies: {
                    package: gitPackage.path + '#~1.0.0'
                }
            }
        }).prepare();

        var package2 = new helpers.TempDir({
            'bower.json': {
                name: 'package2',
                dependencies: {
                    package: gitPackage2.path + '#~2.0.0'
                }
            }
        }).prepare();

        tempDir.prepare({
            'bower.json': {
                name: 'test',
                dependencies: {
                    package2: package2.path,
                    package3: package3.path
                }
            }
        });

        return install([package2.path]).then(function() {
            expect(tempDir.readJson('bower_components/package/.bower.json').version).to.equal('2.0.1');

            rimraf.sync(tempDir.path + '/bower_components/');

            return update(['package3']).then(function() {
                expect(tempDir.readJson('bower_components/package/.bower.json').version).to.equal('1.0.1');
            });
        });
    });

    it('doesn\'t update extraneous packages', function() {
        tempDir.prepare({
            'bower.json': {
                name: 'test'
            }
        });

        return install(['package=' + gitPackage.path + '#1.0.0']).then(function() {

            expect(tempDir.readJson('bower_components/package/.bower.json').version).to.equal('1.0.0');

            return update(null, {
                save: true
            }).then(function() {
                expect(tempDir.readJson('bower_components/package/.bower.json').version).to.equal('1.0.0');
                expect(tempDir.readJson('bower.json')).to.not.have.property('dependencies');
            });
        });
    });

    it('updates bower.json dep after updating with --save flag', function() {
        tempDir.prepare({
            'bower.json': {
                name: 'test',
                dependencies: {
                    package: gitPackage.path + '#~1.0.0'
                }
            }
        });

        return install().then(function() {

            expect(tempDir.readJson('bower.json').dependencies.package).to.equal(gitPackage.path + '#~1.0.0');

            return update(null, {
                save: true
            }).then(function() {
                expect(tempDir.readJson('bower.json').dependencies.package).to.equal(gitPackage.path + '#~1.0.1');
            });
        });
    });

    it('updates bower.json dev dep after updating with --save-dev flag', function() {
        tempDir.prepare({
            'bower.json': {
                name: 'test',
                devDependencies: {
                    package: gitPackage.path + '#~1.0.0'
                }
            }
        });

        return install().then(function() {

            expect(tempDir.readJson('bower.json').devDependencies.package).to.equal(gitPackage.path + '#~1.0.0');

            return update(null, {
                saveDev: true
            }).then(function() {
                expect(tempDir.readJson('bower.json').devDependencies.package).to.equal(gitPackage.path + '#~1.0.1');
            });
        });
    });

    it('replaces "any" range with latest version', function() {
        tempDir.prepare({
            'bower.json': {
                name: 'test',
                dependencies: {
                    package: gitPackage.path + '#*'
                }
            }
        });

        return install().then(function() {

            expect(tempDir.readJson('bower.json').dependencies.package).to.equal(gitPackage.path + '#*');

            return update(null, {
                save: true
            }).then(function() {
                var version = tempDir.readJson('bower.json').dependencies.package.replace(gitPackage.path + '#~', '');
                version = semver.gte(version, '1.0.1');
                expect(version).to.be.ok();
            });
        });
    });

    it('updates multiple components in bower.json after updating with --save flag', function() {
        tempDir.prepare({
            'bower.json': {
                name: 'test',
                dependencies: {
                    package: gitPackage.path + '#~1.0.0',
                    package2: gitPackage2.path + '#~2.0.0'
                },
                devDependencies: {
                    package3: gitPackage3.path + '#~3.0.0'
                },
            }
        });

        return install().then(function() {

            expect(tempDir.readJson('bower.json').dependencies.package).to.equal(gitPackage.path + '#~1.0.0');
            expect(tempDir.readJson('bower.json').dependencies.package2).to.equal(gitPackage2.path + '#~2.0.0');
            expect(tempDir.readJson('bower.json').devDependencies.package3).to.equal(gitPackage3.path + '#~3.0.0');

            return update(null, {
                save: true
            }).then(function() {
                // Normal deps should have changed
                expect(tempDir.readJson('bower.json').dependencies.package).to.equal(gitPackage.path + '#~1.0.1');
                expect(tempDir.readJson('bower.json').dependencies.package2).to.equal(gitPackage2.path + '#~2.0.1');
                // Dev deps should not have changed
                expect(tempDir.readJson('bower.json').devDependencies.package3).to.equal(gitPackage3.path + '#~3.0.0');
            });
        });
    });

    it('updates multiple components in bower.json after updating with --save-dev flag', function() {
        tempDir.prepare({
            'bower.json': {
                name: 'test',
                dependencies: {
                    package: gitPackage.path + '#~1.0.0'
                },
                devDependencies: {
                    package2: gitPackage2.path + '#~2.0.0',
                    package3: gitPackage3.path + '#~3.0.0'
                },
            }
        });

        return install().then(function() {

            expect(tempDir.readJson('bower.json').dependencies.package).to.equal(gitPackage.path + '#~1.0.0');
            expect(tempDir.readJson('bower.json').devDependencies.package2).to.equal(gitPackage2.path + '#~2.0.0');
            expect(tempDir.readJson('bower.json').devDependencies.package3).to.equal(gitPackage3.path + '#~3.0.0');

            return update(null, {
                saveDev: true
            }).then(function() {
                // Normal deps should not have changed
                expect(tempDir.readJson('bower.json').dependencies.package).to.equal(gitPackage.path + '#~1.0.0');
                // Dev deps should have changed
                expect(tempDir.readJson('bower.json').devDependencies.package2).to.equal(gitPackage2.path + '#~2.0.1');
                expect(tempDir.readJson('bower.json').devDependencies.package3).to.equal(gitPackage3.path + '#~3.0.1');
            });
        });
    });

    it('correctly interprets semver range specifier pre-1.0', function() {
        tempDir.prepare({
            'bower.json': {
                name: 'test',
                dependencies: {
                    package: gitPackage.path + '#^0.1.0'
                }
            }
        });

        return install().then(function() {

            expect(tempDir.readJson('bower.json').dependencies.package).to.equal(gitPackage.path + '#^0.1.0');

            return update(null, {
                save: true
            }).then(function() {
                expect(tempDir.readJson('bower.json').dependencies.package).to.equal(gitPackage.path + '#~0.1.1');
            });
        });
    });

    it('correctly interprets semver range specifier post-1.0', function() {
        tempDir.prepare({
            'bower.json': {
                name: 'test',
                dependencies: {
                    package: gitPackage.path + '#^1.0.0'
                }
            }
        });

        return install().then(function() {

            expect(tempDir.readJson('bower.json').dependencies.package).to.equal(gitPackage.path + '#^1.0.0');

            return update(null, {
                save: true
            }).then(function() {
                expect(tempDir.readJson('bower.json').dependencies.package).to.equal(gitPackage.path + '#~1.0.1');
            });
        });
    });

    it('doesn\'t update bower.json if versions are identical', function() {
        tempDir.prepare({
            'bower.json': {
                name: 'test',
                dependencies: {
                    package: gitPackage.path + '#1.0.0'
                }
            }
        });

        return install().then(function() {

            expect(tempDir.readJson('bower.json').dependencies.package).to.equal(gitPackage.path + '#1.0.0');

            return update(null, {
                save: true
            }).then(function() {
                expect(tempDir.readJson('bower.json').dependencies.package).to.equal(gitPackage.path + '#1.0.0');
            });
        });
    });

    it('does not install ignored dependencies when updating a package', function() {
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

        return install().then(function() {

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

            return update().then(function() {
                expect(tempDir.readJson('bower_components/package2/bower.json').version).to.equal('1.0.1');
                expect(tempDir.exists('bower_components/package3')).to.equal(false);
            });
        });
    });

    it('runs preinstall hook when updating a package', function() {
        tempDir.prepare({
            'bower.json': {
                name: 'test',
                dependencies: {
                    package: gitPackage.path + '#1.0.0'
                }
            }
        });

        return install().then(function() {
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
            return update().then(function() {
                expect(tempDir.read('preinstall.txt')).to.be('subPackage package');
            });
        });
    });

    it('runs postinstall hook when updating a package', function() {
        tempDir.prepare({
            'bower.json': {
                name: 'test',
                dependencies: {
                    package: gitPackage.path + '#1.0.0'
                }
            }
        });

        return install().then(function() {
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
            return update().then(function() {
                expect(tempDir.read('postinstall.txt')).to.be('subPackage package');
            });
        });
    });
});
