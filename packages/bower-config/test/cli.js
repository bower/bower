#!/usr/bin/env node

var path = require('path');
var bowerConfig = require('..');

var config = bowerConfig.read(path.join(__dirname + '/assets/env-variables'), {
    foo: 'bar'
});

console.log(config);
