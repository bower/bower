#!/usr/bin/env node

const path = require('path')
const bowerConfig = require('..')

const config = bowerConfig.read(path.join(__dirname + '/assets/env-variables'), { foo: 'bar' })
console.log(config)
