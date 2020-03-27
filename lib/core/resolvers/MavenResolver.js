var util = require('util');
var path = require('path');
var Q = require('q');
var fs = require('graceful-fs');
var url = require('url');
var download = require('../../util/download');
var extract = require('../../util/extract');
var mout = require('mout');
var Resolver = require('./Resolver');
var semver = require('../../util/semver');

function MavenResolver(decEndpoint, config, logger) {
    Resolver.call(this, decEndpoint, config, logger);
}

util.inherits(MavenResolver, Resolver);
mout.object.mixIn(MavenResolver, Resolver);

// -----------------

MavenResolver.getSource = function (source) {
    var uri = this._source || source;

    return uri
        .replace(/^maven\+(https?|file):\/\//i, '$1://')  // Change maven+http or maven+https or maven+file to http(s), file respectively
        .replace('maven://', 'http://')  // Change maven to http
        .replace(/\/+$/, '');  // Remove trailing slashes
};

MavenResolver.prototype.isCacheable = function () {
    return false;
};

MavenResolver.prototype._resolve = function () {
    try {
        return this._findResolution()
            .then(this._artifact.bind(this))
            .spread(this._export.bind(this));
    } catch (e) {
        console.log('Fehler: '+e.stack);
    }
};

MavenResolver.prototype._findResolution = function () {
    var that = this;
    this._source = MavenResolver.getSource(this._source);
    if (semver.validRange(this._target)) {
        return this._versions()
            .then(function(versions) {
                var versionArr = versions.map(function (obj) { return obj.version; });
                var index = semver.maxSatisfyingIndex(versionArr, that._target, true);
                that._resolution = index >= 0 ? versions[index] : null;
                return that._resolution;
            });
    }
    return null;
};

MavenResolver.prototype._savePkgMeta = function (meta) {

    // Save resolution to be used in hasNew later
    meta._release = this._resolution.release;

    return Resolver.prototype._savePkgMeta.call(this, meta);
};

MavenResolver.prototype._versions = function () {
    var file;

    if (this._source.match(/^http/i)) {
        var uri = this._source + '/maven-metadata.xml';
        file = path.join(this._tempDir, 'maven-metadata.xml');
        var protocol = url.parse(uri).protocol;

        var reqHeaders = {};
        if (this._config.userAgent) {
            reqHeaders['User-Agent'] = this._config.userAgent;
        }

        return download(uri, file, {
            proxy: protocol === 'https:' ? this._config.httpsProxy : this._config.proxy,
            strictSSL: this._config.strictSsl,
            timeout: this._config.timeout,
            headers: reqHeaders
        })
            .then(function (response) {
                return MavenResolver.versions(file)
                    .then(function(versions) {
                        fs.unlink(file, function(err) {});
                        return versions;
                    });
            });

    } else {
        file = path.join(this._source, 'maven-metadata-local.xml');
        return MavenResolver.versions(file);
    }
};

MavenResolver.prototype._artifact = function (version) {
    var file;

    if (!version.snapshot) {
        return Q.resolve([version.name, version.artifactId + '-' + version.version + '.zip']);

    } else if (this._source.match(/^http/i)) {
        var uri = this._source + '/' + version.name + '/maven-metadata.xml';
        file = path.join(this._tempDir, 'maven-metadata.xml');
        var protocol = url.parse(uri).protocol;

        var reqHeaders = {};
        if (this._config.userAgent) {
            reqHeaders['User-Agent'] = this._config.userAgent;
        }

        return download(uri, file, {
            proxy: protocol === 'https:' ? this._config.httpsProxy : this._config.proxy,
            strictSSL: this._config.strictSsl,
            timeout: this._config.timeout,
            headers: reqHeaders
        })
            .then(function (response) {
                return MavenResolver.snapshotArtifactName(file)
                    .spread(function(snapshotVersion, artifactName) {
                        fs.unlink(file);
                        version.release = snapshotVersion;
                        return [version.name, artifactName];
                    });
            });

    } else {
        file = path.join(this._source, 'maven-metadata-local.xml');
        return MavenResolver.snapshotArtifactName(file)
            .spread(function(snapshotVersion, artifactName) {
                version.release = snapshotVersion;
                return [version.name, artifactName];
            });
    }
};

MavenResolver.prototype._export = function (versionName, artifactName) {
    var that = this;
    var file;

    if (this._source.match(/^http/i)) {
        var uri = this._source + '/' + versionName + '/' + artifactName;
        file = path.join(this._tempDir, artifactName);
        var protocol = url.parse(uri).protocol;

        var reqHeaders = {};
        if (this._config.userAgent) {
            reqHeaders['User-Agent'] = this._config.userAgent;
        }

        this._logger.action('download', uri, {
            url: that._source,
            to: file
        });

        return download(uri, file, {
            proxy: protocol === 'https:' ? this._config.httpsProxy : this._config.proxy,
            strictSSL: this._config.strictSsl,
            timeout: this._config.timeout,
            headers: reqHeaders
        })
            .then(function() {
                that._logger.action('extract', path.basename(file), {
                    archive: file,
                    to: that._tempDir
                });

                // extract and remove the original downloaded file
                return extract(file, that._tempDir, {
                    mimeType: 'application/zip',
                    keepArchive: false
                });
            });

    } else {

        file = path.join(this._source, versionName, artifactName);
        return extract(file, this._tempDir, {
            mimeType: 'application/zip',
            keepArchive: true
        });
    }
};

MavenResolver.versions = function (file) {
    return Q.nfcall(fs.readFile, file)
        .then(function(text) {
            var reArt = /<artifactId>\s*(.*)\s*<\/artifactId>/igm;
            var reVs = /<versions>([\s\S]*)<\/versions>/igm;
            var reV = /<version>\s*(([\d\.]+)(-SNAPSHOT)?)\s*<\/version>/igm;
            var match;
            var versions = [];
            if ((match = reArt.exec(text)) !== null) {
                var artifactId = match[1];
                if ((match = reVs.exec(text)) !== null) {
                    var vs = match[1];
                    while ((match = reV.exec(vs)) !== null) {
                        versions.push({ artifactId: artifactId, version: match[2], name: match[1], snapshot: match[3], release: match[1] });
                    }
                    versions.sort(function (a, b) {
                        return semver.rcompare(a.version, b.version);
                    });
                    return versions;
                }
            }
            return null;
        });
};

MavenResolver.snapshotArtifactName = function (file) {
    return Q.nfcall(fs.readFile, file)
        .then(function(text) {
            var reArt = /<artifactId>\s*(.*)\s*<\/artifactId>/igm;
            var reSnap = /<snapshotVersion>([\s\S]*)<\/snapshotVersion>/igm;
            var reZip = /<extension>\s*(zip)\s*<\/extension>/igm;
            var reV = /<value>\s*(.*)\s*<\/value>/igm;
            var match;
            if ((match = reArt.exec(text)) !== null) {
                var name = match[1];
                while ((match = reSnap.exec(text)) !== null) {
                    var sv = match[1];
                    if ((match = reZip.exec(sv)) !== null && (match = reV.exec(sv)) !== null) {
                        var value = match[1];
                        return [value, name + '-' + value + '.zip'];
                    }
                }
            }
            return null;
        });
};

module.exports = MavenResolver;
