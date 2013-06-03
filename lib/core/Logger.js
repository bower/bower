var EventEmitter = require('events').EventEmitter;
var util = require('util');

function Logger() {
    this._interceptors = [];
}

util.inherits(Logger, EventEmitter);

Logger.prototype.intercept = function (fn) {
    this._interceptors.push(fn);
    return this;
};

Logger.prototype.pipe = function (emitter) {
    this.on('log', function (log) {
        emitter.emit('log', log);
    });

    return emitter;
};

Logger.prototype.geminate = function () {
    var logger = new Logger();

    logger.pipe(this);
    return logger;
};

Logger.prototype.log = function (level, id, message, data) {
    var log = {
        level: level,
        id: id,
        message: message,
        data: data || {}
    };

    // Run interceptors
    this._runInterceptors(log);

    // Emit log
    this.emit('log', log);

    return this;
};

// ------------------

Logger.prototype._runInterceptors = function (log) {
    // Run interceptors
    this._interceptors.forEach(function (interceptor) {
        interceptor(log);
    });
};

Logger.LEVELS = {
    'error': 5,
    'conflict': 4,
    'warn': 3,
    'action': 2,
    'info': 1,
    'debug': 0
};

// Add helpful log methods
Object.keys(Logger.LEVELS).forEach(function (level) {
    Logger.prototype[level] = function (id, message, data) {
        this.log(level, id, message, data);
    };
});

module.exports = Logger;
