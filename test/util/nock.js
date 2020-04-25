var NODE_MAJOR_VERSION = process.versions.node.split('.')[0];

module.exports =
    NODE_MAJOR_VERSION >= 12 ? require('nock') : require('nock-legacy');
