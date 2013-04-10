var expect = require('expect.js');
var Package = require('../lib/core/Package.js');
var UnitOfWork = require('../lib/core/UnitOfWork');

describe('UnitOfWork', function () {
    describe('.enqueue', function () {
        it('return a promise', function () {
            var pkg = new Package('foo'),
                unitOfWork = new UnitOfWork(),
                promise;

            promise = unitOfWork.enqueue(pkg);

            expect(promise.then).to.be.a('function');
        });

        it('should resolve the promise with a callback that should be called once the package is done resolving', function (done) {
            var pkg = new Package('foo'),
                unitOfWork = new UnitOfWork();

            unitOfWork.enqueue(pkg)
            .then(function (cb) {
                expect(cb).to.be.a('function');
                cb();
                done();
            }, done);
        });

        it('should fire the "enqueue" event', function () {
            var pkg = new Package('foo'),
                unitOfWork = new UnitOfWork(),
                fired = false;

            unitOfWork.on('enqueue', function (pkg) {
                expect(pkg).to.be.an(Package);
                fired = true;
            });
            unitOfWork.enqueue(pkg);

            expect(fired).to.be(true);
        });

        it('should throw if the package is already queued', function () {
            var pkg = new Package('foo'),
                unitOfWork = new UnitOfWork();

            unitOfWork.enqueue(pkg);
            expect(function () {
                unitOfWork.enqueue(pkg);
            }).to.throwException(/already queued/);
        });

        it('should throw if the package is already being resolved', function (done) {
            var pkg = new Package('foo'),
                unitOfWork = new UnitOfWork();

            unitOfWork.enqueue(pkg);

            setTimeout(function () {
                expect(function () {
                    unitOfWork.enqueue(pkg);
                }).to.throwException(/already being resolved/);

                done();
            }, 500);
        });
    });

    describe('.dequeue', function () {
        it('should dequeue a package', function (done) {
            var pkg = new Package('foo'),
                unitOfWork = new UnitOfWork(),
                promise,
                error,
                timeout;

            promise = unitOfWork.enqueue(pkg);
            unitOfWork.dequeue(pkg);

            error = function () {
                clearTimeout(timeout);
                done(new Error('Package was not dequeued'));
            };
            promise.then(error, error);

            timeout = setTimeout(done, 500);
        });

        it('should fire the "dequeue" event if the package was really dequeued', function () {
            var pkg = new Package('foo'),
                unitOfWork = new UnitOfWork(),
                fired = false;

            unitOfWork.on('dequeue', function () {
                fired = true;
            });

            unitOfWork.enqueue(pkg);
            unitOfWork.dequeue(pkg);

            expect(fired).to.be(true);
        });

        it('should not fire the "dequeue" event if the package is not queued', function () {
            var pkg = new Package('foo'),
                unitOfWork = new UnitOfWork(),
                fired = false;

            unitOfWork.on('dequeue', function () {
                fired = true;
            });

            unitOfWork.dequeue(pkg);

            expect(fired).to.be(false);
        });
    });

    describe('.getResolved()', function () {
        it('should always return a valid array/object', function () {
            var unitOfWork = new UnitOfWork();

            expect(unitOfWork.getResolved('foo')).to.eql([]);
            expect(unitOfWork.getResolved()).to.eql({});
        });

        it('should return resolved packages of a specific name', function (done) {
            var unitOfWork = new UnitOfWork(),
                pkg1 = new Package('foo', { name: 'foo' }),
                pkg2 = new Package('bar', { name: 'bar' }),
                pkg3 = new Package('foo', { name: 'foo', range: '~0.0.1' }),
                pkg4 = new Package('bar', { name: 'bar', range: '~0.0.1' }),
                arr;

            function ok(cb, time) {
                return function (cb) {
                    setTimeout(cb, time);
                };
            }

            unitOfWork.enqueue(pkg1).then(ok(50));
            unitOfWork.enqueue(pkg2).then(ok(50));
            unitOfWork.enqueue(pkg3).then(ok(100));
            unitOfWork.enqueue(pkg4).then(ok(100));

            setTimeout(function () {
                arr = unitOfWork.getResolved('foo');
                expect(arr.length).to.be(2);
                expect(arr[0]).to.equal(pkg1);
                expect(arr[1]).to.equal(pkg3);
                arr = unitOfWork.getResolved('bar');
                expect(arr.length).to.be(2);
                expect(arr[0]).to.equal(pkg2);
                expect(arr[1]).to.equal(pkg4);

                done();
            }, 500);
        });

        it('should return all resolved packages', function (done) {
            var unitOfWork = new UnitOfWork({ failFast: false }),
                pkg1 = new Package('foo', { name: 'foo' }),
                pkg2 = new Package('bar', { name: 'bar' }),
                pkg3 = new Package('foo', { name: 'foo', range: '~0.0.1' }),
                pkg4 = new Package('bar', { name: 'bar', range: '~0.0.1' }),
                obj;

            function ok(cb, time) {
                return function (cb) {
                    setTimeout(cb, time);
                };
            }

            unitOfWork.enqueue(pkg1).then(ok(50));
            unitOfWork.enqueue(pkg2).then(ok(50));
            unitOfWork.enqueue(pkg3).then(ok(100));
            unitOfWork.enqueue(pkg4).then(ok(100));

            setTimeout(function () {
                obj = unitOfWork.getResolved();
                expect(Object.keys(obj)).to.eql(['foo', 'bar']);
                expect(obj.foo).to.equal(unitOfWork.getResolved('foo'));
                expect(obj.bar).to.equal(unitOfWork.getResolved('bar'));

                done();
            }, 500);
        });
    });

    describe('.getFailed()', function () {
        it('should always return a valid array/object', function () {
            var unitOfWork = new UnitOfWork();

            expect(unitOfWork.getFailed('foo')).to.eql([]);
            expect(unitOfWork.getFailed()).to.eql({});
        });

        it('should return failed packages of a specific name', function (done) {
            var unitOfWork = new UnitOfWork({ failFast: false }),
                pkg1 = new Package('foo', { name: 'foo' }),
                pkg2 = new Package('bar', { name: 'bar' }),
                pkg3 = new Package('foo', { name: 'foo', range: '~0.0.1' }),
                pkg4 = new Package('bar', { name: 'bar', range: '~0.0.1' }),
                arr;

            function error(cb, time) {
                return function (cb) {
                    setTimeout(cb.bind(cb, new Error('some error')), time);
                };
            }

            unitOfWork.enqueue(pkg1).then(error(50));
            unitOfWork.enqueue(pkg2).then(error(50));
            unitOfWork.enqueue(pkg3).then(error(100));
            unitOfWork.enqueue(pkg4).then(error(100));

            setTimeout(function () {
                arr = unitOfWork.getFailed('foo');
                expect(arr.length).to.be(2);
                expect(arr[0]).to.equal(pkg1);
                expect(arr[1]).to.equal(pkg3);
                arr = unitOfWork.getFailed('bar');
                expect(arr.length).to.be(2);
                expect(arr[0]).to.equal(pkg2);
                expect(arr[1]).to.equal(pkg4);

                done();
            }, 500);
        });

        it('should return all failed packages', function (done) {
            var unitOfWork = new UnitOfWork({ failFast: false }),
                pkg1 = new Package('foo', { name: 'foo' }),
                pkg2 = new Package('bar', { name: 'bar' }),
                pkg3 = new Package('foo', { name: 'foo', range: '~0.0.1' }),
                pkg4 = new Package('bar', { name: 'bar', range: '~0.0.1' }),
                obj;

            function error(cb, time) {
                return function (cb) {
                    setTimeout(cb.bind(cb, new Error('some error')), time);
                };
            }

            unitOfWork.enqueue(pkg1).then(error(50));
            unitOfWork.enqueue(pkg2).then(error(50));
            unitOfWork.enqueue(pkg3).then(error(100));
            unitOfWork.enqueue(pkg4).then(error(100));

            setTimeout(function () {
                obj = unitOfWork.getFailed();
                expect(Object.keys(obj)).to.eql(['foo', 'bar']);
                expect(obj.foo).to.equal(unitOfWork.getFailed('foo'));
                expect(obj.bar).to.equal(unitOfWork.getFailed('bar'));

                done();
            }, 500);
        });
    });

    describe('general stuff', function () {
        it('should let only allow "maxConcurrent" packages to resolve at the same time', function (done) {
            var unitOfWork = new UnitOfWork({ maxConcurrent: 2 }),
                nrBeingResolved = 0,
                pkg1 = new Package('foo'),
                pkg2 = new Package('bar'),
                pkg3 = new Package('baz'),
                timeout;

            unitOfWork.enqueue(pkg1).then(function () { nrBeingResolved++; });
            unitOfWork.enqueue(pkg2).then(function () { nrBeingResolved++; });
            unitOfWork.enqueue(pkg3).then(function () {
                clearTimeout(timeout);
                done(new Error('Maximum concurrent packages not being accounted correctly'));
            });

            timeout = setTimeout(function () {
                expect(nrBeingResolved).to.equal(2);
                done();
            }, 500);
        });

        it('should let every package to resolve if the "maxConcurrent" option is less or equal than 0', function (done) {
            var unitOfWork = new UnitOfWork({ maxConcurrent: 0 }),
                unitOfWork2 = new UnitOfWork({ maxConcurrent: -1 }),
                nrBeingResolved = 0,
                pkg1 = new Package('foo1'),
                pkg2 = new Package('bar1'),
                pkg3 = new Package('baz1'),
                pkg4 = new Package('foo2'),
                pkg5 = new Package('bar2'),
                pkg6 = new Package('baz2'),
                timeout;

            function increment() {
                nrBeingResolved++;
            }

            unitOfWork.enqueue(pkg1).then(increment);
            unitOfWork.enqueue(pkg2).then(increment);
            unitOfWork.enqueue(pkg3).then(increment);
            unitOfWork.enqueue(pkg4).then(increment);
            unitOfWork.enqueue(pkg5).then(increment);
            unitOfWork.enqueue(pkg6).then(increment);
            unitOfWork2.enqueue(pkg1).then(increment);
            unitOfWork2.enqueue(pkg2).then(increment);
            unitOfWork2.enqueue(pkg3).then(increment);
            unitOfWork2.enqueue(pkg4).then(increment);
            unitOfWork2.enqueue(pkg5).then(increment);
            unitOfWork2.enqueue(pkg6).then(increment);

            timeout = setTimeout(function () {
                expect(nrBeingResolved).to.equal(12);
                done();
            }, 500);
        });

        it('should prevent packages with same endpoint from being resolved at the same time', function (done) {
            var unitOfWork = new UnitOfWork({ maxConcurrent: 2 }),
                resolving = [],
                pkg1 = new Package('foo'),
                pkg2 = new Package('foo'),
                pkg3 = new Package('baz');

            unitOfWork.enqueue(pkg1).then(function () { resolving.push('foo'); });
            unitOfWork.enqueue(pkg2).then(function () { resolving.push('foo'); });
            unitOfWork.enqueue(pkg3).then(function () { resolving.push('baz'); });

            setTimeout(function () {
                expect(resolving).to.eql(['foo', 'baz']);
                done();
            }, 500);
        });

        it('should reject promises when a package with same endpoint and range was already resolved', function (done) {
            var unitOfWork = new UnitOfWork(),
                pkg1 = new Package('foo', { range: '~0.1.1' }),
                pkg2 = new Package('foo', { range: '~0.1.1' });

            unitOfWork.enqueue(pkg1).then(function (cb) {
                setTimeout(cb, 200);
            });

            unitOfWork.enqueue(pkg2).then(function () {
                done(new Error('Should have detected a duplicate'));
            }, function (err) {
                expect(err.code).to.equal('EDUPL');
                expect(err.pkg).to.equal(pkg1);
                done();
            });
        });

        it('should fire "dequeue", "before_resolve", "resolve" and "failed" during the resolve process', function (done) {
            var unitOfWork = new UnitOfWork(),
                events = [],
                pkg1 = new Package('foo'),
                pkg2 = new Package('bar');

            unitOfWork.on('dequeue', function (pkg) {
                events.push('dequeue', pkg.getEndpoint());
            });
            unitOfWork.on('before_resolve', function (pkg) {
                events.push('before_resolve', pkg.getEndpoint());
            });
            unitOfWork.on('resolve', function (pkg) {
                events.push('resolve', pkg.getEndpoint());
            });
            unitOfWork.on('failed', function (pkg) {
                events.push('failed', pkg.getEndpoint());
            });

            unitOfWork.enqueue(pkg1).then(function (cb) {
                setTimeout(cb, 100);
            });
            unitOfWork.enqueue(pkg2).then(function (cb) {
                setTimeout(cb.bind(cb, new Error('some error')), 200);
            });

            setTimeout(function () {
                expect(events).to.eql([
                    'dequeue', pkg1.getEndpoint(),
                    'before_resolve', pkg1.getEndpoint(),
                    'dequeue', pkg2.getEndpoint(),
                    'before_resolve', pkg2.getEndpoint(),
                    'resolve', pkg1.getEndpoint(),
                    'failed', pkg2.getEndpoint()
                ]);
                done();
            }, 500);
        });

        it('should fail fast by default', function (done) {
            var unitOfWork = new UnitOfWork({ maxConcurrent: 1 }),
                pkg1 = new Package('foo', { name: 'foo' }),
                pkg2 = new Package('bar', { name: 'bar' });

            unitOfWork.enqueue(pkg1).then(function (cb) {
                setTimeout(cb.bind(cb, new Error('some error')), 200);
            });
            unitOfWork.enqueue(pkg2).then(function () {
                done(new Error('Should have failed fast'));
            }, function (err) {
                expect(err.code).to.equal('EFFAST');
                done();
            });
        });

        it('should not fail fast if the "failFast" option is false', function (done) {
            var unitOfWork = new UnitOfWork({ maxConcurrent: 1, failFast: false }),
                pkg1 = new Package('foo', { name: 'foo' }),
                pkg2 = new Package('bar', { name: 'bar' });

            unitOfWork.enqueue(pkg1).then(function (cb) {
                setTimeout(cb.bind(cb, new Error('some error')), 200);
            });
            unitOfWork.enqueue(pkg2).then(function () {
                done();
            }, function (err) {
                done(err.code === 'EFFAST' ? new Error('Should not have failed fast') : null);
            });
        });
    });
});