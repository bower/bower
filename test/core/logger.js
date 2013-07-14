var expect = require('expect.js');
var EventEmitter = require('events').EventEmitter;
var Logger = require('../../lib/core/Logger');

describe('Logger', function () {
    var logger;

    beforeEach(function () {
        logger = new Logger();
    });

    describe('.constructor', function () {
        it('should provide an instance of Logger', function () {
            expect(logger instanceof Logger).to.be(true);
        });

        it('should provide an instance of EventEmitter', function () {
            expect(logger instanceof EventEmitter).to.be(true);
        });

        it('should have prototype methods', function () {
            var methods = [
                    'intercept', 'pipe', 'geminate', 'log'
                ];

            methods.forEach(function (method) {
                expect(logger).to.have.property(method);
            });
        });
    });

    describe('events', function () {
        var logData = {
            foo: 'bar',
            baz: 'string'
        };

        it('should pass through {}', function (done) {
            logger.on('log', function (log) {
                expect(log.data).to.eql({});
                done();
            });
            logger.info();
        });

        it('should pass through logData', function (done) {
            logger.on('log', function (log) {
                expect(log.data).to.eql(logData);
                done();
            });
            logger.info('foo', 'message', logData);
        });

        it('should emit error event', function (done) {
            logger.on('log', function (log) {
                expect(log.level).to.eql('error');
                expect(log.id).to.eql('foo');
                expect(log.message).to.eql('error message');
                expect(log.data).to.eql({});
                done();
            });
            logger.error('foo', 'error message');
        });

        it('should emit conflict event', function (done) {
            logger.on('log', function (log) {
                expect(log.level).to.eql('conflict');
                expect(log.id).to.eql('foo');
                expect(log.message).to.eql('conflict message');
                expect(log.data).to.eql({});
                done();
            });
            logger.conflict('foo', 'conflict message');
        });

        it('should emit warn event', function (done) {
            logger.on('log', function (log) {
                expect(log.level).to.eql('warn');
                expect(log.id).to.eql('foo');
                expect(log.message).to.eql('warn message');
                expect(log.data).to.eql({});
                done();
            });
            logger.warn('foo', 'warn message');
        });

        it('should emit action event', function (done) {
            logger.on('log', function (log) {
                expect(log.level).to.eql('action');
                expect(log.id).to.eql('foo');
                expect(log.message).to.eql('action message');
                expect(log.data).to.eql({});
                done();
            });
            logger.action('foo', 'action message');
        });

        it('should emit info event', function (done) {
            logger.on('log', function (log) {
                expect(log.level).to.eql('info');
                expect(log.id).to.eql('foo');
                expect(log.message).to.eql('info message');
                expect(log.data).to.eql({});
                done();
            });
            logger.info('foo', 'info message');
        });

        it('should emit debug event', function (done) {
            logger.on('log', function (log) {
                expect(log.level).to.eql('debug');
                expect(log.id).to.eql('foo');
                expect(log.message).to.eql('debug message');
                expect(log.data).to.eql({});
                done();
            });
            logger.debug('foo', 'debug message');
        });
    });

    describe('.intercept', function () {
        it('should add the function and call it when a log occurs', function () {
            var called;
            var data = {
                'some': 'thing'
            };

            logger.intercept(function (log) {
                called = true;

                expect(log).to.eql({
                    level: 'warn',
                    id: 'foo',
                    message: 'bar',
                    data: data
                });
            });

            logger.log('warn', 'foo', 'bar', data);
            expect(called).to.be(true);
        });

        it('should call the interceptors by order before emitting the event', function () {
            var called = [];

            logger.intercept(function () {
                called.push(1);
            });
            logger.intercept(function () {
                called.push(2);
            });

            logger.log('warn', 'foo', 'bar');
            expect(called).to.eql([1, 2]);
        });
    });

    describe('.pipe', function () {
        it('should return the passed emitter', function () {
            var otherEmitter = new EventEmitter();
            expect(logger.pipe(otherEmitter)).to.equal(otherEmitter);
        });

        it('should pipe log events to another emitter', function () {
            var otherEmitter = new EventEmitter();
            var data = {
                'some': 'thing'
            };
            var piped;

            logger.pipe(otherEmitter);

            otherEmitter.on('log', function (log) {
                piped = true;
                expect(log).to.eql({
                    level: 'warn',
                    id: 'foo',
                    message: 'bar',
                    data: data
                });
            });

            logger.log('warn', 'foo', 'bar', data);
            expect(piped).to.be(true);
        });
    });

    describe('.geminate', function () {
        it('should return a new logger instance', function () {
            var newLogger = logger.geminate();

            expect(newLogger).to.be.an(Logger);
            expect(newLogger).to.be.an(EventEmitter);
            expect(newLogger).to.not.be.equal(logger);
        });

        it('should pipe the new logger events to the original logger', function () {
            var piped;
            var newLogger = logger.geminate();
            var data = {
                'some': 'thing'
            };

            logger.on('log', function (log) {
                piped = true;
                expect(log).to.eql({
                    level: 'warn',
                    id: 'foo',
                    message: 'bar',
                    data: data
                });
            });

            newLogger.log('warn', 'foo', 'bar', data);
            expect(piped).to.be(true);
        });
    });
});
