var events   = require('events');

var UnitWork = function () {
  this.locks = [];
  this.data = [];
};

UnitWork.prototype = Object.create(events.EventEmitter.prototype);

UnitWork.prototype.constructor = UnitWork;

UnitWork.prototype.lock = function (key, owner) {
  if (this.locks[key]) throw new Error('A lock for "' + key + '" was already acquired.');
  if (!owner) throw new Error('A lock requires an owner.');
  this.locks[key] = owner;

  return this;
};

UnitWork.prototype.unlock = function (key, owner) {
  if (!owner) throw new Error('A lock requires an owner.');
  if (this.locks[key]) {
    if (this.locks[key] !== owner) throw new Error('Lock owner for  "' + key + '" mismatch.');
    delete this.locks[key];
  }

  return this;
};

UnitWork.prototype.isLocked = function (key) {
  return this.locks[key];
};

UnitWork.prototype.store = function (key, data) {
  if (this.locks[key]) throw new Error('A lock for "' + key + '" is acquired, therefore no data can be written.');

  this.data[key] = data;
  this.emit('store', key);

  return this;
};

UnitWork.prototype.retrieve = function (key) {
  return this.data[key];
};

UnitWork.prototype.keys = function () {
  return Object.keys(this.data);
};

module.exports = UnitWork;