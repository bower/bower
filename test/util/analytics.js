var expect = require('expect.js');
var proxyquire = require('proxyquire');
var object = require('mout').object;

describe('analytics', function () {

    var mockAnalytics = function(stubs, promptResponse) {
        return proxyquire('../../lib/util/analytics', {
            insight: function () {
                return object.merge(stubs || {}, {
                    askPermission: function (message, callback) {
                        callback(undefined, promptResponse);
                    }
                });
            },
        });
    };

    describe('#setup', function () {
        it('leaves analytics enabled if provided', function () {
            var config = { analytics: true };

            return mockAnalytics().setup(config).then(function () {
                expect(config.analytics).to.be(true);
            });
        });

        it('leaves analytics disabled if provided', function () {
            var config = { analytics: false };

            return mockAnalytics().setup(config).then(function () {
                expect(config.analytics).to.be(false);
            });
        });

        it('defaults to false if insight.optOut is true', function () {
            var config = { };

            return mockAnalytics({ optOut: true }).setup(config).then(function () {
                expect(config.analytics).to.be(false);
            });
        });

        it('defaults to true if insight.optOut is false', function () {
            var config = { };

            return mockAnalytics({ optOut: false }).setup(config).then(function () {
                expect(config.analytics).to.be(true);
            });
        });

        it('defaults to true if insight.optOut is undefined and noninteractive', function () {
            var config = { };

            return mockAnalytics({ optOut: undefined }).setup(config).then(function () {
                expect(config.analytics).to.be(true);
            });
        });

        it('defautls to true if interactive insights return true from prompt', function () {
            var config = { interactive: true };

            return mockAnalytics({ optOut: undefined }, true).setup(config).then(function () {
                expect(config.analytics).to.be(true);
            });
        });

        it('defautls to false if interactive insights return false from prompt', function () {
            var config = { interactive: true };

            return mockAnalytics({ optOut: undefined }, false).setup(config).then(function () {
                expect(config.analytics).to.be(false);
            });
        });
    });

    describe('Tracker', function (next) {
        it('tracks if analytics = true', function(next) {
            var analytics = mockAnalytics({
                track: function (arg) {
                    expect(arg).to.be('foo');
                    next();
                }
            });

            new analytics.Tracker({
                analytics: true
            }).track('foo');
        });

        it('does not track if analytics = false', function () {
            var analytics = mockAnalytics({
                track: function (arg) {
                    throw new Error();
                }
            });

            expect(function () {
                new analytics.Tracker({
                    analytics: false
                }).track('foo');
            }).to.not.throwError();
        });
    });
});
