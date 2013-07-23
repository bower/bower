var expect = require('expect.js');
var mout = require('mout');
var endpointParser = require('../');

describe('endpoint-parser', function () {
    describe('.decompose', function () {
        it('should decompose endpoints correctly', function () {
            var suite = {
                'jquery#~2.0.0': { name: '', source: 'jquery', target: '~2.0.0' },
                'jquery#*': { name: '', source: 'jquery', target: '*' },
                'jquery#latest': { name: '', source: 'jquery', target: '*' },
                'jquery#3dc50c62fe2d2d01afc58e7ad42236a35acff4d8': { name: '', source: 'jquery', target: '3dc50c62fe2d2d01afc58e7ad42236a35acff4d8' },
                'jquery#master': { name: '', source: 'jquery', target: 'master' },
                'backbone=backbone-amd#~1.0.0': { name: 'backbone', source: 'backbone-amd', target: '~1.0.0' },
                'backbone=backbone-amd#latest': { name: 'backbone', source: 'backbone-amd', target: '*' },
                'backbone=backbone-amd#*': { name: 'backbone', source: 'backbone-amd', target: '*' },
                'http://twitter.github.io/bootstrap/assets/bootstrap.zip': { name: '', source: 'http://twitter.github.io/bootstrap/assets/bootstrap.zip', target: '*' },
                'bootstrap=http://twitter.github.io/bootstrap/assets/bootstrap.zip': { name: 'bootstrap', source: 'http://twitter.github.io/bootstrap/assets/bootstrap.zip', target: '*' },
                'bootstrap=http://twitter.github.io/bootstrap/assets/bootstrap.zip#latest': { name: 'bootstrap', source: 'http://twitter.github.io/bootstrap/assets/bootstrap.zip', target: '*' }
            };

            mout.object.forOwn(suite, function (decEndpoint, endpoint) {
                expect(endpointParser.decompose(endpoint)).to.eql(decEndpoint);
            });
        });
    });

    describe('.compose', function () {
        it('should compose endpoints correctly', function () {
            var suite = {
                'jquery#~2.0.0': { name: '', source: 'jquery', target: '~2.0.0' },
                'jquery': [{ name: '', source: 'jquery', target: '*' }, { name: '', source: 'jquery', target: 'latest' }, { name: '', source: 'jquery', target: '' }],
                'jquery#3dc50c62fe2d2d01afc58e7ad42236a35acff4d8': { name: '', source: 'jquery', target: '3dc50c62fe2d2d01afc58e7ad42236a35acff4d8' },
                'jquery#master': { name: '', source: 'jquery', target: 'master' },
                'backbone=backbone-amd#~1.0.0': { name: 'backbone', source: 'backbone-amd', target: '~1.0.0' },
                'backbone=backbone-amd': [{ name: 'backbone', source: 'backbone-amd', target: '*' }, { name: 'backbone', source: 'backbone-amd', target: '*' }, { name: 'backbone', source: 'backbone-amd', target: '' }],
                'http://twitter.github.io/bootstrap/assets/bootstrap.zip': { name: '', source: 'http://twitter.github.io/bootstrap/assets/bootstrap.zip', target: '*' },
                'bootstrap=http://twitter.github.io/bootstrap/assets/bootstrap.zip': { name: 'bootstrap', source: 'http://twitter.github.io/bootstrap/assets/bootstrap.zip', target: '*' }
            };

            mout.object.forOwn(suite, function (decEndpoints, endpoint) {
                decEndpoints = mout.lang.toArray(decEndpoints);
                decEndpoints.forEach(function (decEndpoint) {
                    expect(endpointParser.compose(decEndpoint)).to.equal(endpoint);
                });
            });
        });
    });

    describe('.json2decomposed', function () {
        it('should decompose json endpoints correctly', function () {
            var dependencies = {
                jquery: '~1.9.1',
                foo: 'latest',
                bar: '*',
                baz: '#~0.2.0',
                backbone: 'backbone-amd#~1.0.0',
                backbone2: 'backbone=backbone-amd#~1.0.0',
                bootstrap: 'http://twitter.github.io/bootstrap/assets/bootstrap',
                bootstrap2: 'http://twitter.github.io/bootstrap/assets/bootstrap#*',
                ssh: 'git@example.com',
                git: 'git://example.com',
                path: '/foo',
                winpath: 'c:\\foo'
            };
            var expected = [
                { name: 'jquery', source: 'jquery', target: '~1.9.1' },
                { name: 'foo', source: 'foo', target: '*' },
                { name: 'bar', source: 'bar', target: '*' },
                { name: 'baz', source: 'baz', target: '~0.2.0' },
                { name: 'backbone', source: 'backbone-amd', target: '~1.0.0' },
                { name: 'backbone2', source: 'backbone=backbone-amd', target: '~1.0.0' },
                { name: 'bootstrap', source: 'http://twitter.github.io/bootstrap/assets/bootstrap', target: '*' },
                { name: 'bootstrap2', source: 'http://twitter.github.io/bootstrap/assets/bootstrap', target: '*' },
                { name: 'ssh', source: 'git@example.com', target: '*' },
                { name: 'git', source: 'git://example.com', target: '*' },
                { name: 'path', source: '/foo', target: '*' },
                { name: 'winpath', source: 'c:\\foo', target: '*' }
            ];
            var x = 0;

            mout.object.forOwn(dependencies, function (value, key) {
                expect(endpointParser.json2decomposed(key, value)).to.eql(expected[x]);
                x += 1;
            });
        });
    });

    describe('.decomposed2json', function () {
        it('should compose endpoints to json correctly', function () {
            var decEndpoints = [
                { name: 'jquery', source: 'jquery', target: '~1.9.1' },
                { name: 'foo', source: 'foo', target: 'latest' },
                { name: 'bar', source: 'bar', target: '*' },
                { name: 'baz', source: 'baz', target: '' },
                { name: 'jqueryx', source: 'jquery', target: '~1.9.1' },
                { name: 'backbone', source: 'backbone-amd', target: '~1.0.0' },
                { name: 'backbone', source: 'backbone=backbone-amd', target: '~1.0.0' },
                { name: 'bootstrap', source: 'http://twitter.github.io/bootstrap/assets/bootstrap', target: '' },
                { name: 'bootstrap', source: 'http://twitter.github.io/bootstrap/assets/bootstrap', target: '*' },
                { name: 'ssh', source: 'git@example.com', target: '*' },
                { name: 'git', source: 'git://example.com', target: '*' }
            ];
            var expected = [
                { jquery: '~1.9.1' },
                { foo: '*' },
                { bar: '*' },
                { baz: '*' },
                { jqueryx: 'jquery#~1.9.1' },
                { backbone: 'backbone-amd#~1.0.0' },
                { backbone : 'backbone=backbone-amd#~1.0.0' },
                { bootstrap: 'http://twitter.github.io/bootstrap/assets/bootstrap' },
                { bootstrap: 'http://twitter.github.io/bootstrap/assets/bootstrap' },
                { ssh: 'git@example.com' },
                { git: 'git://example.com' }
            ];
            var x = 0;

            decEndpoints.forEach(function (decEndpoint) {
                expect(endpointParser.decomposed2json(decEndpoint)).to.eql(expected[x]);
                x += 1;
            });
        });

        it('should throw an error if name is empty', function () {
            try {
                endpointParser.decomposed2json({ name: '', source: 'jquery', target: '*' });
            } catch (e) {
                expect(e.code).to.equal('EINVEND');
                expect(e.message).to.contain('must have a name');
                return;
            }

            throw new Error('Should have failed');
        });
    });
});
