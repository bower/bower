var expect = require('expect.js');
var fs = require('graceful-fs');
var path = require('path');
var util = require('util');
var rimraf = require('rimraf');
var mkdirp = require('mkdirp');
var tmp = require('tmp');
var Q = require('q');
var cmd = require('../../../lib/util/cmd');
var copy = require('../../../lib/util/copy');
var Resolver = require('../../../lib/core/resolvers/Resolver');
var Logger = require('../../../lib/core/Logger');
var defaultConfig = require('../../../lib/config');

describe('Resolver', function () {
    var tempDir = path.resolve(__dirname, '../../assets/tmp');
    var testPackage = path.resolve(__dirname, '../../assets/github-test-package');
    var logger;

    before(function () {
        logger = new Logger();
    });

    afterEach(function () {
        logger.removeAllListeners();
    });

    function create(decEndpoint, config) {
        if (typeof decEndpoint === 'string') {
            decEndpoint = { source: decEndpoint };
        }

        return new Resolver(decEndpoint, config || defaultConfig, logger);
    }

    describe('.getSource', function () {
        it('should return the resolver source', function () {
            var resolver = create('foo');

            expect(resolver.getSource()).to.equal('foo');
        });
    });

    describe('.getName', function () {
        it('should return the resolver name', function () {
            var resolver = create({ source: 'foo', name: 'bar' });

            expect(resolver.getName()).to.equal('bar');
        });

        it('should return the resolver source if none is specified (default guess mechanism)', function () {
            var resolver = create('foo');

            expect(resolver.getName()).to.equal('foo');
        });
    });

    describe('.getTarget', function () {
        it('should return the resolver target', function () {
            var resolver = create({ source: 'foo', target: '~2.1.0' });

            expect(resolver.getTarget()).to.equal('~2.1.0');
        });

        it('should return * if none was configured', function () {
            var resolver = create('foo');

            expect(resolver.getTarget()).to.equal('*');
        });

        it('should return * if latest was configured (for backwards compatibility)', function () {
            var resolver = create('foo');

            expect(resolver.getTarget()).to.equal('*');
        });
    });

    describe('.hasNew', function () {
        before(function () {
            mkdirp.sync(tempDir);
        });

        beforeEach(function () {
            fs.writeFileSync(path.join(tempDir, '.bower.json'), JSON.stringify({
                name: 'test'
            }));
        });

        after(function (next) {
            rimraf(tempDir, next);
        });

        it('should throw an error if already working (resolving)', function (next) {
            var resolver = create('foo');
            var succeeded;

            resolver._resolve = function () {};

            resolver.resolve()
            .then(function () {
                // Test if resolve can be called again when done
                resolver.resolve()
                .then(function () {
                    next(succeeded ? new Error('Should have failed') : null);
                });
            })
            .done();

            resolver.hasNew(tempDir)
            .then(function () {
                succeeded = true;
            }, function (err) {
                expect(err).to.be.an(Error);
                expect(err.code).to.equal('EWORKING');
                expect(err.message).to.match(/already working/i);
            });
        });

        it('should throw an error if already working (checking for newer version)', function (next) {
            var resolver = create('foo');
            var succeeded;

            resolver.hasNew(tempDir)
            .then(function () {
                // Test if hasNew can be called again when done
                resolver.hasNew(tempDir)
                .then(function () {
                    next(succeeded ? new Error('Should have failed') : null);
                });
            })
            .done();

            resolver.hasNew(tempDir)
            .then(function () {
                succeeded = true;
            }, function (err) {
                expect(err).to.be.an(Error);
                expect(err.code).to.equal('EWORKING');
                expect(err.message).to.match(/already working/i);
            });
        });

        it('should resolve to true by default', function (next) {
            var resolver = create('foo');

            resolver.hasNew(tempDir)
            .then(function (hasNew) {
                expect(hasNew).to.equal(true);
                next();
            })
            .done();
        });

        it('should resolve to true if the there\'s an error reading the package meta', function (next) {
            var resolver = create('foo');

            rimraf.sync(path.join(tempDir, '.bower.json'));
            resolver.hasNew(tempDir)
            .then(function (hasNew) {
                expect(hasNew).to.equal(true);
                next();
            })
            .done();
        });

        it('should call _hasNew with the canonical dir and the package meta', function (next) {
            var resolver = create('foo');
            var canonical;
            var meta;

            resolver._hasNew = function (canonicalDir, pkgMeta) {
                canonical = canonicalDir;
                meta = pkgMeta;
                return Q.resolve(true);
            };

            resolver.hasNew(tempDir)
            .then(function () {
                expect(canonical).to.equal(tempDir);
                expect(meta).to.be.an('object');
                expect(meta.name).to.equal('test');
                next();
            })
            .done();
        });

        it('should not read the package meta if already passed', function (next) {
            var resolver = create('foo');
            var meta;

            resolver._hasNew = function (canonicalDir, pkgMeta) {
                meta = pkgMeta;
                return Q.resolve(true);
            };

            resolver.hasNew(tempDir, {
                name: 'foo'
            })
            .then(function () {
                expect(meta).to.be.an('object');
                expect(meta.name).to.equal('foo');
                next();
            })
            .done();
        });
    });

    describe('.resolve', function () {
        it('should reject the promise if _resolve is not implemented', function (next) {
            var resolver = create('foo');

            resolver.resolve()
            .then(function () {
                next(new Error('Should have rejected the promise'));
            }, function (err) {
                expect(err).to.be.an(Error);
                expect(err.message).to.contain('_resolve not implemented');
                next();
            })
            .done();
        });

        it('should throw an error if already working (resolving)', function (next) {
            var resolver = create('foo');
            var succeeded;

            resolver._resolve = function () {};

            resolver.resolve()
            .then(function () {
                // Test if resolve can be called again when done
                resolver.resolve()
                .then(function () {
                    next(succeeded ? new Error('Should have failed') : null);
                });
            })
            .done();

            resolver.resolve()
            .then(function () {
                succeeded = true;
            }, function (err) {
                expect(err).to.be.an(Error);
                expect(err.code).to.equal('EWORKING');
                expect(err.message).to.match(/already working/i);
            });
        });

        it('should throw an error if already working (checking newer version)', function (next) {
            var resolver = create('foo');
            var succeeded;

            resolver._resolve = function () {};

            resolver.hasNew(tempDir)
            .then(function () {
                // Test if hasNew can be called again when done
                resolver.hasNew(tempDir)
                .then(function () {
                    next(succeeded ? new Error('Should have failed') : null);
                });
            })
            .done();

            resolver.resolve()
            .then(function () {
                succeeded = true;
            }, function (err) {
                expect(err).to.be.an(Error);
                expect(err.code).to.equal('EWORKING');
                expect(err.message).to.match(/already working/i);
            });
        });

        it('should call all the functions necessary to resolve by the correct order', function (next) {
            var resolver;

            function DummyResolver() {
                Resolver.apply(this, arguments);
                this._stack = [];
            }

            util.inherits(DummyResolver, Resolver);

            DummyResolver.prototype.getStack = function () {
                return this._stack;
            };

            DummyResolver.prototype.resolve = function () {
                this._stack = [];
                return Resolver.prototype.resolve.apply(this, arguments);
            };

            DummyResolver.prototype._createTempDir = function () {
                this._stack.push('before _createTempDir');
                return Resolver.prototype._createTempDir.apply(this, arguments)
                .then(function (val) {
                    this._stack.push('after _createTempDir');
                    return val;
                }.bind(this));
            };
            DummyResolver.prototype._resolve = function () {};
            DummyResolver.prototype._readJson = function () {
                this._stack.push('before _readJson');
                return Resolver.prototype._readJson.apply(this, arguments)
                .then(function (val) {
                    this._stack.push('after _readJson');
                    return val;
                }.bind(this));
            };
            DummyResolver.prototype._applyPkgMeta = function () {
                this._stack.push('before _applyPkgMeta');
                return Resolver.prototype._applyPkgMeta.apply(this, arguments)
                .then(function (val) {
                    this._stack.push('after _applyPkgMeta');
                    return val;
                }.bind(this));
            };
            DummyResolver.prototype._savePkgMeta = function () {
                this._stack.push('before _savePkgMeta');
                return Resolver.prototype._savePkgMeta.apply(this, arguments)
                .then(function (val) {
                    this._stack.push('after _savePkgMeta');
                    return val;
                }.bind(this));
            };

            resolver = new DummyResolver({ source: 'foo'}, defaultConfig, logger);

            resolver.resolve()
            .then(function () {
                expect(resolver.getStack()).to.eql([
                    'before _createTempDir',
                    'after _createTempDir',
                    'before _readJson',
                    'after _readJson',
                    // Both below are called in parallel
                    'before _applyPkgMeta',
                    'after _applyPkgMeta',
                    'before _savePkgMeta',
                    'after _savePkgMeta'
                ]);
                next();
            })
             .done();
        });

        it('should resolve with the canonical dir (folder)', function (next) {
            var resolver = create('foo');

            resolver._resolve = function () {};

            resolver.resolve()
            .then(function (folder) {
                expect(folder).to.be.a('string');
                expect(fs.existsSync(folder)).to.be(true);
                next();
            })
            .done();
        });
    });

    describe('.getTempDir', function () {
        it('should return null if resolver is not yet resolved', function () {
            var resolver = create('foo');

            expect(resolver.getTempDir() == null).to.be(true);
        });

        it('should still return null if resolve failed', function () {
            it('should still return null', function (next) {
                var resolver = create('foo');

                resolver._resolve = function () {
                    throw new Error('I\'ve failed to resolve');
                };

                resolver.resolve()
                .fail(function () {
                    expect(resolver.getTempDir() == null).to.be(true);
                    next();
                });
            });
        });

        it('should return the canonical dir (folder) if resolve succeeded', function (next) {
            var resolver = create('foo');

            resolver._resolve = function () {};

            resolver.resolve()
            .then(function () {
                var dir = resolver.getTempDir();

                expect(dir).to.be.a('string');
                expect(fs.existsSync(dir)).to.be(true);
                next();
            })
            .done();
        });
    });

    describe('.getPkgMeta', function () {
        it('should return null if resolver is not yet resolved', function () {
            var resolver = create('foo');

            expect(resolver.getPkgMeta() == null).to.be(true);
        });

        it('should still return null if resolve failed', function () {
            it('should still return null', function (next) {
                var resolver = create('foo');

                resolver._resolve = function () {
                    throw new Error('I\'ve failed to resolve');
                };

                resolver.resolve()
                .fail(function () {
                    expect(resolver.getPkgMeta() == null).to.be(true);
                    next();
                });
            });
        });

        it('should return the package meta if resolve succeeded', function (next) {
            var resolver = create('foo');

            resolver._resolve = function () {};

            resolver.resolve()
            .then(function () {
                expect(resolver.getPkgMeta()).to.be.an('object');
                next();
            })
            .done();
        });
    });

    describe('._createTempDir', function () {
        var dirMode0777;

        before(function () {
            var stat;

            mkdirp.sync(tempDir);
            stat = fs.statSync(tempDir);
            dirMode0777 = stat.mode;
        });

        after(function (next) {
            rimraf(tempDir, next);
        });

        it('should create a directory inside a bower folder, located within the OS temp folder', function (next) {
            var resolver = create('foo');

            resolver._createTempDir()
            .then(function (dir) {
                var dirname;
                var osTempDir;

                expect(dir).to.be.a('string');
                expect(fs.existsSync(dir)).to.be(true);

                dirname = path.dirname(dir);
                osTempDir = path.resolve(tmp.tmpdir);

                expect(path.basename(dirname)).to.equal('bower');
                expect(path.dirname(dirname)).to.equal(osTempDir);
                next();
            })
            .done();
        });

        it('should set the dir mode the same as the process', function (next) {
            var resolver = create('foo');

            resolver._createTempDir()
            .then(function (dir) {
                var stat = fs.statSync(dir);
                var expectedMode = dirMode0777 & ~process.umask();

                expect(stat.mode).to.equal(expectedMode);
                next();
            })
            .done();
        });

        it('should remove the folder after execution', function (next) {
            var bowerOsTempDir = path.join(tmp.tmpdir, 'bower');

            rimraf(bowerOsTempDir, function (err) {
                if (err) return next(err);

                cmd('node', ['test/assets/test-temp-dir/test.js'], { cwd: path.resolve(__dirname, '../../..') })
                .then(function () {
                    expect(fs.existsSync(bowerOsTempDir)).to.be(true);
                    expect(fs.readdirSync(bowerOsTempDir)).to.eql([]);
                    next();
                }, function (err) {
                    next(new Error(err.details));
                })
                .done();
            });
        });

        it('should remove the folder on an uncaught exception', function (next) {
            var bowerOsTempDir = path.join(tmp.tmpdir, 'bower');

            rimraf(bowerOsTempDir, function (err) {
                if (err) return next(err);

                cmd('node', ['test/assets/test-temp-dir/test-exception.js'], { cwd: path.resolve(__dirname, '../../..') })
                .then(function () {
                    next(new Error('The command should have failed'));
                }, function () {
                    expect(fs.existsSync(bowerOsTempDir)).to.be(true);
                    expect(fs.readdirSync(bowerOsTempDir)).to.eql([]);
                    next();
                })
                .done();
            });
        });

        it('should set _tempDir with the created directory', function (next) {
            var resolver = create('foo');

            resolver._createTempDir()
            .then(function (dir) {
                expect(resolver._tempDir).to.be.ok();
                expect(resolver._tempDir).to.equal(dir);
                next();
            })
            .done();
        });
    });

    describe('._readJson', function () {
        afterEach(function (next) {
            rimraf(tempDir, next);
        });

        it('should read the bower.json file', function (next) {
            var resolver = create('foo');

            mkdirp.sync(tempDir);
            fs.writeFileSync(path.join(tempDir, 'bower.json'), JSON.stringify({ name: 'foo', version: '0.0.0' }));
            fs.writeFileSync(path.join(tempDir, 'component.json'), JSON.stringify({ name: 'bar', version: '0.0.0' }));

            resolver._readJson(tempDir)
            .then(function (meta) {
                expect(meta).to.be.an('object');
                expect(meta.name).to.equal('foo');
                expect(meta.version).to.equal('0.0.0');
                next();
            })
            .done();
        });

        it('should fallback to component.json (notifying a warn)', function (next) {
            var resolver = create('foo');
            var notified = false;

            mkdirp.sync(tempDir);
            fs.writeFileSync(path.join(tempDir, 'component.json'), JSON.stringify({ name: 'bar', version: '0.0.0' }));

            logger.on('log', function (log) {
                expect(log).to.be.an('object');
                if (log.level === 'warn' && /deprecated/i.test(log.id)) {
                    expect(log.message).to.contain('component.json');
                    notified = true;
                }
            });

            resolver._readJson(tempDir)
            .then(function (meta) {
                expect(meta).to.be.an('object');
                expect(meta.name).to.equal('bar');
                expect(meta.version).to.equal('0.0.0');
                expect(notified).to.be(true);
                next();
            })
            .done();
        });

        it('should resolve to an inferred json if no json file was found', function (next) {
            var resolver = create('foo');

            resolver._readJson(tempDir)
            .then(function (meta) {
                expect(meta).to.be.an('object');
                expect(meta.name).to.equal('foo');
                next();
            })
            .done();
        });

        it.skip('should apply normalisation, defaults and validation to the json object');
    });

    describe('._applyPkgMeta', function () {
        afterEach(function (next) {
            rimraf(tempDir, next);
        });

        it('should resolve with the same package meta', function (next) {
            var resolver = create('foo');
            var meta = { name: 'foo' };

            mkdirp.sync(tempDir);
            resolver._tempDir = tempDir;

            resolver._applyPkgMeta(meta)
            .then(function (retMeta) {
                expect(retMeta).to.equal(meta);

                // Test also with the ignore property because the code is different
                meta = { name: 'foo', ignore: ['somefile'] };

                return resolver._applyPkgMeta(meta)
                .then(function (retMeta) {
                    expect(retMeta).to.equal(meta);
                    next();
                });
            })
            .done();
        });

        it('should remove files that match the ignore patterns', function (next) {
            var resolver = create({ source: 'foo', name: 'foo' });

            mkdirp.sync(tempDir);

            // Checkout test package version 0.2.1 which has a bower.json
            // with ignores
            cmd('git', ['checkout', '0.2.1'], { cwd: testPackage })
            // Copy its contents to the temporary dir
            .then(function () {
                return copy.copyDir(testPackage, tempDir);
            })
            .then(function () {
                var json;

                // This is a very rudimentary check
                // Complete checks are made in the 'describe' below
                resolver._tempDir = tempDir;
                json = JSON.parse(fs.readFileSync(path.join(tempDir, 'bower.json')).toString());

                return resolver._applyPkgMeta(json)
                .then(function () {
                    expect(fs.existsSync(path.join(tempDir, 'foo'))).to.be(true);
                    expect(fs.existsSync(path.join(tempDir, 'test'))).to.be(false);
                    next();
                });
            })
            .done();
        });

        describe('handling of ignore property according to the .gitignore spec', function () {
            it.skip('A blank line matches no files, so it can serve as a separator for readability.');
            it.skip('A line starting with # serves as a comment.');
            it.skip('An optional prefix ! which negates the pattern; any matching file excluded by a previous pattern will become included again...', function () {
                // If a negated pattern matches, this will override lower precedence patterns sources. Put a backslash ("\") in front of the first "!" for patterns that begin with a literal "!", for example, "\!important!.txt".
            });
            it.skip('If the pattern ends with a slash, it is removed for the purpose of the following description, but it would only find a match with a directory...', function () {
                // In other words, foo/ will match a directory foo and paths underneath it, but will not match a regular file or a symbolic link foo (this is consistent with the way how pathspec works in general in git).
            });
            it.skip('If the pattern does not contain a slash /, git treats it as a shell glob pattern and checks for a match against the pathname without leading directories.');
            it.skip('Otherwise, git treats the pattern as a shell glob suitable for consumption by fnmatch(3) with the FNM_PATHNAME flag..', function () {
                // wildcards in the pattern will not match a / in the pathname. For example, "Documentation/*.html" matches "Documentation/git.html" but not "Documentation/ppc/ppc.html" or "tools/perf/Documentation/perf.html".
            });
        });
    });

    describe('._savePkgMeta', function () {
        before(function () {
            mkdirp.sync(tempDir);
        });

        afterEach(function (next) {
            rimraf(path.join(tempDir, '.bower.json'), next);
        });

        after(function (next) {
            rimraf(tempDir, next);
        });

        it('should resolve with the same package meta', function (next) {
            var resolver = create('foo');
            var meta = { name: 'foo' };

            resolver._tempDir = tempDir;

            resolver._savePkgMeta(meta)
            .then(function (retMeta) {
                expect(retMeta).to.equal(meta);
                next();
            })
            .done();
        });

        it('should set the original source and target in package meta file', function (next) {
            var resolver = create({ source: 'bar', target: '~2.0.0' });
            var meta = { name: 'foo' };

            resolver._tempDir = tempDir;

            resolver._savePkgMeta(meta)
            .then(function (retMeta) {
                expect(retMeta._source).to.equal('bar');
                expect(retMeta._target).to.equal('~2.0.0');
                next();
            })
            .done();
        });

        it('should save the package meta to the package meta file (.bower.json)', function (next) {
            var resolver = create('foo');

            resolver._tempDir = tempDir;

            resolver._savePkgMeta({ name: 'bar' })
            .then(function (retMeta) {
                fs.readFile(path.join(tempDir, '.bower.json'), function (err, contents) {
                    if (err) return next(err);

                    contents = contents.toString();
                    expect(JSON.parse(contents)).to.eql(retMeta);
                    next();
                });
            })
            .done();
        });
    });

    describe('#isTargetable', function () {
        it('should return true by default', function () {
            expect(Resolver.isTargetable()).to.be(true);
        });
    });

    describe('#versions', function () {
        it('should resolve to an array by default', function (next) {
            Resolver.versions()
            .then(function (versions) {
                expect(versions).to.be.an('array');
                expect(versions.length).to.be(0);

                next();
            })
            .done();
        });
    });
});
