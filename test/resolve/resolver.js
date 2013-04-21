var expect = require('expect.js');
var fs = require('fs');
var path = require('path');
var util = require('util');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var Resolver = require('../../lib/resolve/Resolver');

describe('Resolver', function () {
    describe('.getSource', function () {
        it('should return the resolver source', function () {
            var resolver = new Resolver('foo');

            expect(resolver.getSource()).to.equal('foo');
        });
    });

    describe('.getName', function () {
        it('should return the resolver name', function () {
            var resolver = new Resolver('foo', { name: 'bar' });

            expect(resolver.getName()).to.equal('bar');
        });

        it('should return the resolver source if none is specified (default guess mechanism)', function () {
            var resolver = new Resolver('foo');

            expect(resolver.getName()).to.equal('foo');
        });
    });

    describe('.getTarget', function () {
        it('should return the resolver target', function () {
            var resolver = new Resolver('foo', { target: '~2.1.0' });

            expect(resolver.getTarget()).to.equal('~2.1.0');
        });

        it('should return * if none was configured', function () {
            var resolver = new Resolver('foo');

            expect(resolver.getTarget()).to.equal('*');
        });
    });

    describe('.hasNew', function () {
        it('should return a promise', function (done) {
            var resolver = new Resolver('foo'),
                promise = resolver.hasNew('.');

            expect(promise).to.be.an('object');
            expect(promise.then).to.be.an('function');
            promise.then(done.bind(done, null), done.bind(done, null));
        });

        it('should resolve to true by default', function (next) {
            var resolver = new Resolver('foo');

            resolver.hasNew('.')
            .then(function (hasNew) {
                expect(hasNew).to.equal(true);
                next();
            })
            .done();
        });
    });

    describe('.resolve', function () {
        it('should return a promise', function (done) {
            var resolver = new Resolver('foo'),
                promise = resolver.resolve();

            expect(promise).to.be.an('object');
            expect(promise.then).to.be.an('function');
            promise.then(done.bind(done, null), done.bind(done, null));
        });

        it('should reject the promise if _resolveSelf is not implemented', function (done) {
            var resolver = new Resolver('foo');

            resolver.resolve()
            .then(function () {
                done(new Error('Should have rejected the promise'));
            }, function (err) {
                expect(err).to.be.an(Error);
                expect(err.message).to.contain('not implemented');
                done();
            });
        });

        it('should call all the functions necessary to resolve by the correct order', function (next) {
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
            DummyResolver.prototype._resolveSelf = function () {};
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

            var resolver = new DummyResolver('foo');

            resolver.resolve()
            .then(function () {
                expect(resolver.getStack()).to.eql([
                    'before _createTempDir',
                    'after _createTempDir',
                    'before _readJson',
                    'after _readJson',
                    // Both below are called in parallel
                    'before _applyPkgMeta',
                    'before _savePkgMeta',
                    'after _applyPkgMeta',
                    'after _savePkgMeta'
                ]);
                next();
            })
             .done();
        });

        it('should resolve with the canonical package (folder)', function (next) {
            var resolver = new Resolver('foo');

            resolver._resolveSelf = function () {};

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
            var resolver = new Resolver('foo');

            expect(resolver.getTempDir() == null).to.be(true);
        });

        it('should still return null if resolved failed', function () {
            it('should still return null', function (next) {
                var resolver = new Resolver('foo');

                resolver._resolveSelf = function () {
                    throw new Error('I\'ve failed to resolve');
                };

                resolver.resolve()
                .then(null, function () {
                    expect(resolver.getTempDir() == null).to.be(true);
                    next();
                });
            });
        });

        it('should return the canonical package (folder) if resolve succeeded', function (next) {
            var resolver = new Resolver('foo');

            resolver._resolveSelf = function () {};

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
            var resolver = new Resolver('foo');

            expect(resolver.getPkgMeta() == null).to.be(true);
        });

        it('should still return null if resolved failed', function () {
            it('should still return null', function (next) {
                var resolver = new Resolver('foo');

                resolver._resolveSelf = function () {
                    throw new Error('I\'ve failed to resolve');
                };

                resolver.resolve()
                .then(null, function () {
                    expect(resolver.getPkgMeta() == null).to.be(true);
                    next();
                });
            });
        });

        it('should return the package meta if resolve succeeded', function (next) {
            var resolver = new Resolver('foo');

            resolver._resolveSelf = function () {};

            resolver.resolve()
            .then(function () {
                expect(resolver.getPkgMeta()).to.be.an('object');
                next();
            })
            .done();
        });
    });

    describe('_createTempDir', function () {
        it('should return a promise', function (done) {
            var resolver = new Resolver('foo'),
                promise = resolver._createTempDir();

            expect(promise).to.be.an('object');
            expect(promise.then).to.be.an('function');
            promise.then(done.bind(done, null), done.bind(done, null));
        });
        it.skip('should create a directory inside a bower folder, located within the OS temp folder');
        it.skip('should set the dir mode the same as the process');
        it.skip('should remove the folder after execution');
        it.skip('should set _tempDir with the created directory');
    });

    describe('_readJson', function () {
        it('should return a promise', function (done) {
            var resolver = new Resolver('foo'),
                promise = resolver._readJson();

            expect(promise).to.be.an('object');
            expect(promise.then).to.be.an('function');
            promise.then(done.bind(done, null), done.bind(done, null));
        });
        it.skip('should read the bower.json file');
        it.skip('should fallback to component.json');
        it.skip('should resolve to an inferred json if no json file was found');
        it.skip('should apply normalisation, defaults and validation to the json object');
    });

    describe('_applyPkgMeta', function () {
        it('should return a promise', function (done) {
            var resolver = new Resolver('foo'),
                promise = resolver._applyPkgMeta({ name: 'foo' });

            expect(promise).to.be.an('object');
            expect(promise.then).to.be.an('function');
            promise.then(done.bind(done, null), done.bind(done, null));
        });

        it('should resolve with the the same package meta', function (next) {
            var resolver = new Resolver('foo'),
                meta = { name: 'foo' };

            resolver._applyPkgMeta(meta)
            .then(function (retMeta) {
                expect(retMeta).to.equal(meta);

                // Test also with the ignore property because the code is different
                meta = { name: 'foo', ignore: ['somefile'] };
                resolver._applyPkgMeta(meta)
                .then(function (retMeta) {
                    expect(retMeta).to.equal(meta);
                    next();
                })
                .done();
            })
            .done();
        });

        it('should fire the "name_change" event if the json name is different than the guessed one', function (next) {
            var resolver = new Resolver('foo'),
                newName;

            resolver.on('name_change', function (name) {
                newName = name;
            });

            resolver._applyPkgMeta({ name: 'bar' })
            .then(function (retMeta) {
                expect(retMeta.name).to.equal('bar');
                expect(resolver.getName()).to.equal('bar');
                expect(newName).to.equal('bar');
                next();
            })
            .done();
        });

        it('should not fire the "name_change" event if the json name is different but the name was not guessed', function (next) {
            var resolver = new Resolver('foo', { name: 'foo' }),
                newName;

            resolver.on('name_change', function (name) {
                newName = name;
            });

            resolver._applyPkgMeta({ name: 'bar' })
            .then(function (retMeta) {
                expect(retMeta.name).to.equal('foo');
                expect(resolver.getName()).to.equal('foo');
                expect(newName).to.not.be.ok();
                next();
            })
            .done();
        });

        it('should not fire the "name_change" event the json name is the same', function (next) {
            var resolver = new Resolver('foo'),
                newName;

            resolver.on('name_change', function (name) {
                newName = name;
            });

            resolver._applyPkgMeta({ name: 'foo' })
            .then(function (retMeta) {
                expect(retMeta.name).to.equal('foo');
                expect(resolver.getName()).to.equal('foo');
                expect(newName).to.not.be.ok();

                resolver = new Resolver('foo', { name: 'foo' });

                resolver.on('name_change', function (name) {
                    newName = name;
                });

                resolver._applyPkgMeta({ name: 'foo' })
                .then(function (retMeta) {
                    expect(retMeta.name).to.equal('foo');
                    expect(resolver.getName()).to.equal('foo');
                    expect(newName).to.not.be.ok();
                    next();
                })
                .done();
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

    describe('_savePkgMeta', function () {
        var tempDir = path.normalize(__dirname + '/../assets/tmp');

        beforeEach(function (next) {
            mkdirp(tempDir, next);
        });

        afterEach(function (next) {
            rimraf(tempDir, next);
        });

        it('should return a promise', function (done) {
            var resolver = new Resolver('foo'),
                promise;

            resolver._tempDir = tempDir;
            promise = resolver._savePkgMeta({ name: 'foo' });

            expect(promise).to.be.an('object');
            expect(promise.then).to.be.an('function');
            promise.then(done.bind(done, null), done.bind(done, null));
        });

        it('should resolve with the the same package meta', function (next) {
            var resolver = new Resolver('foo'),
                meta = { name: 'foo' };

            resolver._tempDir = tempDir;

            resolver._savePkgMeta(meta)
            .then(function (retMeta) {
                expect(retMeta).to.equal(meta);
                next();
            })
            .done();
        });

        it('should save the package meta to the package meta file (.bower.json)', function (next) {
            var resolver = new Resolver('foo');

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
});