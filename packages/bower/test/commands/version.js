var expect = require('expect.js');

var helpers = require('../helpers');
var version = helpers.require('lib/commands').version;

describe('bower version', function () {

    var mainPackage = new helpers.TempDir({
        'v0.0.0': {
            'bower.json': {
                name: 'foobar',
            }
        }
    });

    it('bumps patch version', function () {
        mainPackage.prepareGit();

        return helpers.run(version, ['patch', {}, { cwd: mainPackage.path }]).then(function () {
            expect(mainPackage.latestGitTag()).to.be('0.0.1');
        });
    });

    it('bumps minor version', function () {
        mainPackage.prepareGit();

        return helpers.run(version, ['minor', {}, { cwd: mainPackage.path }]).then(function () {
            expect(mainPackage.latestGitTag()).to.be('0.1.0');
        });
    });

    it('bumps major version', function () {
        mainPackage.prepareGit();

        return helpers.run(version, ['major', {}, { cwd: mainPackage.path }]).then(function () {
            expect(mainPackage.latestGitTag()).to.be('1.0.0');
        });
    });

    it('changes version', function () {
        mainPackage.prepareGit();

        return helpers.run(version, ['1.2.3', {}, { cwd: mainPackage.path }]).then(function () {
            expect(mainPackage.latestGitTag()).to.be('1.2.3');
        });
    });

    it('returns the new version', function () {
        mainPackage.prepareGit();

        return helpers.run(version, ['major', {}, { cwd: mainPackage.path }]).then(function (results) {
            expect(results[0]).to.be('v1.0.0');
        });
    });

    it('fails on a dirty git repository', function () {
        mainPackage.prepareGit();
        mainPackage.create({
            'dirty.txt': 'This file has not been committed'
        });

        return helpers.run(version, ['patch', {}, { cwd: mainPackage.path }]).then(null, function (err) {
            expect(err).to.be.an(Error);
            expect(err.code).to.be('ENOTGITREPOSITORY');
        });
    });

    it('fails when the version already exists', function () {
        mainPackage.prepareGit();

        return helpers.run(version, ['0.0.0', {}, { cwd: mainPackage.path }]).then(null, function (err) {
            expect(err).to.be.an(Error);
            expect(err.code).to.be('EVERSIONEXISTS');
        });
    });

    it('fails with an invalid argument', function () {
        mainPackage.prepareGit();

        return helpers.run(version, ['lol', {}, { cwd: mainPackage.path }]).then(null, function (err) {
            expect(err).to.be.an(Error);
            expect(err.code).to.be('EINVALIDVERSION');
        });
    });

    it('bumps with custom commit message', function () {
        mainPackage.prepareGit();

        return helpers.run(version, ['patch', { message: 'Bumping %s, because what'}, { cwd: mainPackage.path }]).then(function () {
            var tags = mainPackage.git('tag');
            expect(tags).to.be('v0.0.0\nv0.0.1\n');
            var message = mainPackage.git('log', '--pretty=format:%s', '-n1');
            expect(message).to.be('Bumping v0.0.1, because what');
        });
    });

    it('creates commit and tags', function () {
        mainPackage.prepareGit();

        return helpers.run(version, ['patch', {}, { cwd: mainPackage.path }]).then(function () {
            var tags = mainPackage.git('tag');
            expect(tags).to.be('v0.0.0\nv0.0.1\n');
            var message = mainPackage.git('log', '--pretty=format:%s', '-n1');
            expect(message).to.be('v0.0.1');
        });
    });

    it('assumes v0.0.0 when no tags exist', function () {
        var packageWithoutTags = new helpers.TempDir({});

        packageWithoutTags.prepareGit();
        packageWithoutTags.create({
            'index.js': 'console.log("hello, world");'
        });
        packageWithoutTags.git('add', '-A');
        packageWithoutTags.git('commit', '-m"commit"');

        return helpers.run(version, ['major', {}, { cwd: packageWithoutTags.path }]).then(function () {
            expect(packageWithoutTags.latestGitTag()).to.be('1.0.0');
        });
    });
});
