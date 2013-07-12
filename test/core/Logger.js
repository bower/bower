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

    describe('Instance', function () {
        describe('Events', function () {
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
    });
});
