var expect = require('expect.js');
var Q = require('q');
var Worker = require('../../lib/resolve/Worker');

describe('Worker', function () {
    var timeout;

    afterEach(function () {
        if (timeout) {
            clearTimeout(timeout);
            timeout = null;
        }
    });

    describe('.enqueue', function () {
        it('return a promise', function () {
            var worker = new Worker(),
                promise;

            promise = worker.enqueue(function () { return Q.resolve('foo'); });

            expect(promise).to.be.an('object');
            expect(promise.then).to.be.a('function');
        });

        it('should call the function and resolve', function (next) {
            var worker = new Worker();

            worker.enqueue(function () { return Q.resolve('foo'); })
            .then(function (ret) {
                expect(ret).to.equal('foo');
                next();
            })
            .done();
        });

        it('should work with functions that return values syncronously', function (next) {
            var worker = new Worker();

            worker.enqueue(function () { return 'foo'; })
            .then(function (ret) {
                expect(ret).to.equal('foo');
                next();
            })
            .done();
        });

        it('should assume the default concurrency when a type is not specified', function (next) {
            var worker = new Worker(1),
                calls = 0;

            worker.enqueue(function () { calls++; return Q.defer().promise; });
            worker.enqueue(function () { next(new Error('Should not be called!')); });

            timeout = setTimeout(function () {
                expect(calls).to.equal(1);
                next();
            }, 100);
        });

        it('should assume the default concurrency when a type is not known', function (next) {
            var worker = new Worker(1),
                calls = 0;

            worker.enqueue(function () { calls++; return Q.defer().promise; }, 'foo_type');
            worker.enqueue(function () { next(new Error('Should not be called!')); }, 'foo_type');

            timeout = setTimeout(function () {
                expect(calls).to.equal(1);
                next();
            }, 100);
        });

        it('should have different slots when type is not passed or is not known', function (next) {
            var worker = new Worker(1),
                calls = 0;

            worker.enqueue(function () { calls++; return Q.defer().promise; });
            worker.enqueue(function () { calls++; return Q.defer().promise; }, 'foo_type');
            worker.enqueue(function () { next(new Error('Should not be called!')); });
            worker.enqueue(function () { next(new Error('Should not be called!')); }, 'foo_type');

            timeout = setTimeout(function () {
                expect(calls).to.equal(2);
                next();
            }, 100);
        });

        it('should use the configured concurrency for the type', function (next) {
            var worker = new Worker(1, {
                foo: 2,
                bar: 3
            }),
                calls = {
                    def: 0,
                    foo: 0,
                    bar: 0
                };

            worker.enqueue(function () { calls.def++; return Q.defer().promise; });
            worker.enqueue(function () { next(new Error('Should not be called!')); });
            worker.enqueue(function () { calls.foo++; return Q.defer().promise; }, 'foo');
            worker.enqueue(function () { calls.foo++; return Q.defer().promise; }, 'foo');
            worker.enqueue(function () { calls.bar++; return Q.defer().promise; }, 'bar');
            worker.enqueue(function () { calls.bar++; return Q.defer().promise; }, 'bar');
            worker.enqueue(function () { calls.bar++; return Q.defer().promise; }, 'bar');
            worker.enqueue(function () { next(new Error('Should not be called!')); }, 'bar');

            timeout = setTimeout(function () {
                expect(calls.def).to.equal(1);
                expect(calls.foo).to.equal(2);
                expect(calls.bar).to.equal(3);
                next();
            }, 100);
        });
    });

    describe('.abort', function () {
        it('should clear the whole queue', function (next) {
            var worker = new Worker(1, {
                foo: 2
            }),
                calls = 0;

            worker.enqueue(function () { calls++; return Q.resolve(); });
            worker.enqueue(function () { next(new Error('Should not be called!')); });
            worker.enqueue(function () { calls++; return Q.resolve(); }, 'foo');
            worker.enqueue(function () { calls++; return Q.resolve(); }, 'foo');
            worker.enqueue(function () { next(new Error('Should not be called!')); }, 'foo');

            worker.abort();

            worker.enqueue(function () { calls++; return Q.resolve(); }, 'foo');

            timeout = setTimeout(function () {
                expect(calls).to.equal(4);
                next();
            }, 100);
        });

        it('should wait for currently running functions to finish', function (next) {
            var worker = new Worker(1, {
                foo: 2
            }),
                calls = [];

            worker.enqueue(function () { calls.push(1); return Q.resolve(); });
            worker.enqueue(function () { calls.push(2); return Q.resolve(); });
            worker.enqueue(function () {
                var deferred = Q.defer();

                setTimeout(function () {
                    calls.push(3);
                    deferred.resolve();
                }, 100);

                return deferred.promise;
            }, 'foo');

            timeout = setTimeout(function () {
                worker.abort().then(function () {
                    expect(calls).to.eql([1, 2, 3]);
                    next();
                });
            }, 30);
        });
    });


    describe('scheduler', function () {
        it('should start remaining tasks when one ends', function (next) {
            var worker = new Worker(1, {
                foo: 2
            }),
                calls = 0;

            worker.enqueue(function () { calls++; return Q.resolve(); });
            worker.enqueue(function () { calls++; return Q.resolve(); }, 'foo');
            worker.enqueue(function () { calls++; return Q.resolve(); }, 'foo');
            worker.enqueue(function () { calls++; return Q.resolve(); });
            worker.enqueue(function () { calls++; return Q.resolve(); }, 'foo');

            timeout = setTimeout(function () {
                expect(calls).to.equal(5);
                next();
            }, 100);
        });

        it('should respect the enqueue order', function (next) {
            var worker = new Worker(1),
                defCalls = [],
                fooCalls = [];

            worker.enqueue(function () {
                defCalls.push(1);
                return Q.resolve();
            });

            worker.enqueue(function () {
                defCalls.push(2);
                return Q.resolve();
            });

            worker.enqueue(function () {
                defCalls.push(3);
                return Q.resolve();
            });

            worker.enqueue(function () {
                fooCalls.push(1);
                return Q.resolve();
            }, 'foo');

            worker.enqueue(function () {
                fooCalls.push(2);
                return Q.resolve();
            }, 'foo');

            worker.enqueue(function () {
                fooCalls.push(3);
                return Q.resolve();
            }, 'foo');

            timeout = setTimeout(function () {
                expect(defCalls).to.eql([1, 2, 3]);
                expect(fooCalls).to.eql([1, 2, 3]);
                next();
            }, 100);
        });

        it('should wait for one slot in every type on a multi-type function', function (next) {
            var worker = new Worker(1, {
                foo: 1,
                bar: 2
            }),
                calls = 0;

            worker.enqueue(function () { return Q.defer().promise; }, 'foo');
            worker.enqueue(function () { return Q.defer().promise; }, 'bar');

            worker.enqueue(function () { calls++; return Q.resolve(); }, 'bar');
            worker.enqueue(function () { next(new Error('Should not be called!')); }, ['foo', 'bar']);
            worker.enqueue(function () { calls++; return Q.resolve(); }, 'bar');
            worker.enqueue(function () { next(new Error('Should not be called!')); }, 'foo');

            timeout = setTimeout(function () {
                expect(calls).to.equal(2);
                next();
            }, 100);
        });

        it('should free all type slots when finished running a function', function (next) {
            var worker = new Worker(1, {
                foo: 1,
                bar: 2
            }),
                calls = 0;

            worker.enqueue(function () { return Q.defer().promise; }, 'bar');
            worker.enqueue(function () { calls++; return Q.resolve(); }, ['foo', 'bar']);
            worker.enqueue(function () { calls++; return Q.resolve(); }, 'foo');
            worker.enqueue(function () { calls++; return Q.resolve(); }, 'bar');

            timeout = setTimeout(function () {
                expect(calls).to.equal(3);
                next();
            }, 100);
        });
    });
});