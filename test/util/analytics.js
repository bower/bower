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
                    },
                    config: {
                        clear: function () {}
                    }
                });
            }
        });
    };

    describe('#setup', function () {
        // Reset process.env.CI after tests are done
        var oldCI;
        beforeEach(function () {
            oldCI = process.env.CI;
        });
        afterEach(function () {
            process.env.CI = oldCI;
        });

        it('leaves analytics enabled if provided', function () {
            return mockAnalytics()
                .setup({ analytics: true })
                .then(function (enabled) {
                    expect(enabled).to.be(true);
                });
        });

        it('leaves analytics disabled if provided', function () {
            return mockAnalytics()
                .setup({ analytics: false })
                .then(function (enabled) {
                    expect(enabled).to.be(false);
                });
        });

        it('disables analytics for non-interactive mode', function () {
            return mockAnalytics()
                .setup({ interactive: false })
                .then(function (enabled) {
                    expect(enabled).to.be(false);
                });
        });

        it('disables if insight.optOut is true and interactive', function () {
            return mockAnalytics({ optOut: true })
                .setup({ interactive: true })
                .then(function (enabled) {
                    expect(enabled).to.be(false);
                });
        });

        it('enables if insight.optOut is false and interactive', function () {
            return mockAnalytics({ optOut: false })
                .setup({ interactive: true })
                .then(function (enabled) {
                    expect(enabled).to.be(true);
                });
        });

        it('disables if insight.optOut is false and non-interactive', function () {
            return mockAnalytics({ optOut: false })
                .setup({ interactive: false })
                .then(function (enabled) {
                    expect(enabled).to.be(false);
                });
        });

        it('enables if interactive insights return true from prompt', function () {
            return mockAnalytics({ optOut: undefined }, true)
                .setup({ interactive: true })
                .then(function (enabled) {
                    expect(enabled).to.be(true);
                });
        });

        it('disables if interactive insights return false from prompt', function () {
            return mockAnalytics({ optOut: undefined }, false)
                .setup({ interactive: true })
                .then(function (enabled) {
                    expect(enabled).to.be(false);
                });
        });

        it('disables if process.env.CI is true', function () {
            process.env.CI = true;

            // Clear cache set by proxyquire
            delete require.cache[require.resolve('../../lib/util/analytics')];

            var analytics = require('../../lib/util/analytics');
            return analytics.setup({ interactive: true })
                .then(function (enabled) {
                    expect(enabled).to.be(false);
                });
        });

        it('disables if prompt times out', function () {
            // Create mock insight with very low permission timeout
            var Insight = require('insight');
            var mockInsight = new Insight({
                trackingCode: 'mock',
                pkg: require('../../package.json')
            });
            mockInsight._permissionTimeout = 0.1;
            var mockAnalyticsWithInsight = proxyquire('../../lib/util/analytics', {
                insight: function () {
                    return mockInsight;
                }
            });

            return mockAnalyticsWithInsight
                .setup({ interactive: true })
                .then(function (enabled) {
                    expect(enabled).to.be(false);
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

            new analytics.Tracker({ analytics: true }).track('foo');
        });

        it('does not track if analytics = false', function () {
            var analytics = mockAnalytics({
                track: function (arg) {
                    throw new Error();
                }
            });

            expect(function () {
                new analytics.Tracker({ analytics: false }).track('foo');
            }).to.not.throwError();
        });

        it('tracks if analytics = undefined and setup returns true', function(next) {
            var analytics = mockAnalytics({
                track: function (arg) {
                    expect(arg).to.be('foo');
                    next();
                }
            });

            analytics
                .setup({ analytics: true })
                .then(function () {
                    new analytics.Tracker({}).track('foo');
                });
        });
    });
});
