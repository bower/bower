var expect = require('expect.js');
var EventEmitter = require('events').EventEmitter;
var Logger = require('../../lib/core/Logger');

describe('Logger', function () {

    beforeEach(function () {
        this.logger = new Logger();
    });

    describe('.constructor', function () {

        it('should provide an instance of Logger', function () {
            expect(this.logger instanceof Logger).to.be(true);
        });

        it('should provide an instance of EventEmitter', function () {
            expect(this.logger instanceof EventEmitter).to.be(true);
        });

        it('should have prototype methods', function () {
            var self = this,
                methods = [
                    'intercept', 'pipe', 'geminate', 'log'
                ];

            methods.forEach(function (method) {
                expect(self.logger).to.have.property(method);
            });

        });

    });

    describe('Instance', function () {

        describe('Events', function () {

            beforeEach(function () {
                this.logData = {
                    foo: 'bar',
                    baz: 'string'
                };
            });

            it('should pass through {}', function (done) {
                this.logger.on('log', function (log) {
                    expect(log.data).to.eql({});
                    done();
                });
                this.logger.info();
            });

            it('should pass through logData', function (done) {
                var self = this;

                this.logger.on('log', function (log) {
                    expect(log.data).to.eql(self.logData);
                    done();
                });
                this.logger.info('info', 'message', this.logData);
            });

            it('should emit error event', function (done) {
                this.logger.on('log', function (log) {
                    expect(log.level).to.eql('error');
                    expect(log.id).to.eql('error');
                    expect(log.message).to.eql('error message');
                    expect(log.data).to.eql({});
                    done();
                });
                this.logger.error('error', 'error message');
            });

            it('should emit conflict event', function (done) {
                this.logger.on('log', function (log) {
                    expect(log.level).to.eql('conflict');
                    expect(log.id).to.eql('conflict');
                    expect(log.message).to.eql('conflict message');
                    expect(log.data).to.eql({});
                    done();
                });
                this.logger.conflict('conflict', 'conflict message');
            });

            it('should emit warn event', function (done) {
                this.logger.on('log', function (log) {
                    expect(log.level).to.eql('warn');
                    expect(log.id).to.eql('warn');
                    expect(log.message).to.eql('warn message');
                    expect(log.data).to.eql({});
                    done();
                });
                this.logger.warn('warn', 'warn message');
            });

            it('should emit action event', function (done) {
                this.logger.on('log', function (log) {
                    expect(log.level).to.eql('action');
                    expect(log.id).to.eql('action');
                    expect(log.message).to.eql('action message');
                    expect(log.data).to.eql({});
                    done();
                });
                this.logger.action('action', 'action message');
            });

            it('should emit info event', function (done) {
                this.logger.on('log', function (log) {
                    expect(log.level).to.eql('info');
                    expect(log.id).to.eql('info');
                    expect(log.message).to.eql('info message');
                    expect(log.data).to.eql({});
                    done();
                });
                this.logger.info('info', 'info message');
            });

            it('should emit debug event', function (done) {
                this.logger.on('log', function (log) {
                    expect(log.level).to.eql('debug');
                    expect(log.id).to.eql('debug');
                    expect(log.message).to.eql('debug message');
                    expect(log.data).to.eql({});
                    done();
                });
                this.logger.debug('debug', 'debug message');
            });

        });

    });

});

