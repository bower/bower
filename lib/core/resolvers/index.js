module.exports = {
    GitFs: require('./GitFsResolver'),
    GitRemote: require('./GitRemoteResolver'),
    GitHub: require('./GitHubResolver'),
	Hg: require('./HgResolver'),
    Svn: require('./SvnResolver'),
    Fs: require('./FsResolver'),
    Url: require('./UrlResolver')
};
