describe('GitFsResolver', function () {
    describe('._resolveSelf', function () {
        it.skip('should call all the functions necessary to resolve by the correct order');
    });

    describe('._copy', function () {
        it.skip('should copy files from the source to the temporary directory');
        it.skip('should not copy over the files specified in the ignore list');
    });

    describe('._checkout', function () {
        it.skip('should checkout correctly if resolution is a branch');
        it.skip('should checkout correctly if resolution is a tag');
        it.skip('should checkout correctly if resolution is a commit');
        it.skip('should remove any untracked files and directories');
    });

    describe('#fetchRefs', function () {
        it('should resolve to the references of the local repository', function () {

        });

        it('should cache the results', function () {

        });
    });
});