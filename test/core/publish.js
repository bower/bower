var path = require('path');
var fs = require('fs');
var zlib = require('zlib');
var tar = require('tar');
var expect = require('expect.js');
var publish = require('../../lib/commands/publish.js');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var Logger = require('bower-logger');

describe('publish', function () {

    var packageName = 'a';
    var packageVer = '0.2.0';
    var archiveFile = packageName + '-' + packageVer + '.tgz';
    var packageArchive = path.join(__dirname, '../assets/package-publish.tar.gz');
    var tempDir = path.join(__dirname, '../assets/temp-publish');

    before(function (next) {
        mkdirp(tempDir, function () {
            //extract package-publish into dir
            fs.createReadStream(packageArchive)
                .pipe(zlib.createGunzip())
                .pipe(tar.Extract({ path: tempDir}))
                .on('end', next);
        });
    });

    after(function (next) {
        rimraf(tempDir,  next);
    });

    it('create the archive correctly', function (next) {

        publish._createArchive(tempDir, new Logger()).then(function (outputFile) {

            expect(path.basename(outputFile)).to.be(archiveFile);

            var pathsInTar = [];

            fs.createReadStream(outputFile)
                .pipe(zlib.createGunzip())
                .pipe(tar.Parse())
                .on('entry', function (e) {
                    pathsInTar.push(e.path);
                })
                .on('end', function () {

                    expect(pathsInTar).to.have.length(7);
                    expect(pathsInTar).to.contain('temp-publish/README.md');
                    expect(pathsInTar).to.contain('temp-publish/bar');
                    expect(pathsInTar).to.contain('temp-publish/baz');
                    expect(pathsInTar).to.contain('temp-publish/bower.json');
                    expect(pathsInTar).to.contain('temp-publish/foo');
                    expect(pathsInTar).to.contain('temp-publish/more/');
                    expect(pathsInTar).to.contain('temp-publish/more/more-foo');

                    fs.unlinkSync(outputFile);

                    next();
                });

        }).done();

    });


});