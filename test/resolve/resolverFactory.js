var BASE_DIR = '../../';

var expect = require('expect.js');
var resolverFactory   = require(BASE_DIR + 'lib/resolve/resolverFactory');
var FsResolver        = require(BASE_DIR + 'lib/resolve/resolvers/FsResolver');
var GitFsResolver     = require(BASE_DIR + 'lib/resolve/resolvers/GitFsResolver');
var GitRemoteResolver = require(BASE_DIR + 'lib/resolve/resolvers/GitRemoteResolver');
var UrlResolver       = require(BASE_DIR + 'lib/resolve/resolvers/UrlResolver');
var async             = require('async');

function resolverType(resolver) {
    if (resolver instanceof FsResolver) {
        return 'FsResolver';
    }

    if (resolver instanceof GitFsResolver) {
        return 'GitFsResolver';
    }

    if (resolver instanceof GitRemoteResolver) {
        return 'GitRemoteResolver';
    }

    if (resolver instanceof UrlResolver) {
        return 'UrlResolver';
    }

    return 'unknown';
}

describe.skip('resolverFactory', function () {
    describe('create', function () {
        it.skip('should separate the target correctly from the endpoint', function (done) {

        });

        it('should recognize the source type correctly', function (done) {
            var testResolverType = function (endpoint, expectedType, next) {
                resolverFactory(endpoint).done(function (resolver) {
                    expect(resolverType(resolver)).to.equal(expectedType);

                    next();
                });
            };

            var testSubjects = {
                'git://github.com/user/project.git': 'GitRemoteResolver',
                'git://github.com/user/project.git#commit-ish': 'GitRemoteResolver',
                'git+ssh://user@hostname:project.git': 'GitRemoteResolver',
                'git+ssh://user@hostname:project.git#commit-ish': 'GitRemoteResolver',
                'git+ssh://user@hostname/project.git': 'GitRemoteResolver',
                'git+ssh://user@hostname/project.git#commit-ish': 'GitRemoteResolver',
                'git+http://user@hostname/project/blah.git': 'GitRemoteResolver',
                'git+http://user@hostname/project/blah.git#commit-ish': 'GitRemoteResolver',
                'git+https://user@hostname/project/blah.git': 'GitRemoteResolver',
                'git+https://user@hostname/project/blah.git#commit-ish': 'GitRemoteResolver'
            };

            testSubjects[__dirname]  = 'FsResolver';
            testSubjects[__filename] = 'FsResolver';
            testSubjects[BASE_DIR]   = 'GitFsResolver';

            for (var k in testSubjects) {
                testSubjects[k] = testResolverType.bind(null, k, testSubjects[k]);
            }

            async.parallel(testSubjects, function (err) {
                return done(err);
            });
        });
    });
});