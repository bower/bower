var Q = require('q');
var mout = require('mout');

var analytics = module.exports;
var insight;

// Initializes the application-wide insight singleton and asks for the
// permission on the CLI during the first run.
analytics.setup = function setup(config) {
    var deferred = Q.defer();

    // Display the ask prompt only if it hasn't been answered before
    // and the current session is looking to configure the analytics.
    if (config.analytics) {
        var Insight = require('insight');
        var pkg = require('../../package.json');

        insight = new Insight({
            trackingCode: 'UA-43531210-1',
            packageName: pkg.name,
            packageVersion: pkg.version
        });

        if (insight.optOut === undefined) {
            insight.askPermission(null, deferred.resolve);
        } else {
            deferred.resolve();
        }
    } else {
        deferred.resolve();
    }

    return deferred.promise;
};

var Tracker = analytics.Tracker = function Tracker(config) {
    if (!config.analytics) {
        this.track = function noop() {};
    }
};

Tracker.prototype.track = function track() {
    if (!insight) {
        throw new Error('You must call analytics.setup() prior to tracking.');
    }
    insight.track.apply(insight, arguments);
};

Tracker.prototype.trackDecomposedEndpoints = function trackDecomposedEndpoints(command, endpoints) {
    endpoints.forEach(function (endpoint) {
        this.track(command, endpoint.source, endpoint.target);
    }.bind(this));
};

Tracker.prototype.trackPackages = function trackPackages(command, packages) {
    mout.object.forOwn(packages, function (package) {
        var meta = package.pkgMeta;
        this.track(command, meta.name, meta.version);
    }.bind(this));
};

Tracker.prototype.trackNames = function trackNames(command, names) {
    names.forEach(function (name) {
        this.track(command, name);
    }.bind(this));
};
