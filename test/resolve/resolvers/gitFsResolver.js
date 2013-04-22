describe('GitFsResolver', function () {
    describe('.resolve', function () {
        it.skip('should resolve to the latest commit if a repository has no tags');
        it.skip('should resolve to the specified range');
        it.skip('should resolve to the specified version');
        it.skip('should resolve to the specified commit');
        it.skip('should resolve to the specified branch');
        it.skip('should resolve to the specified commit');
        it.skip('should remove the .git folder');
        it.skip('should not copy the ignored files to the temp directory');
    });

    describe('.hasNew', function () {
        it.skip('should detect a new version if the resolution type changed');
        it.skip('should detect a new version if the resolved version changed');
        it.skip('should detect a new version if the resolved commit changed (branch)');
        it.skip('should detect a new version if the resolved commit changed (commit)');
    });
});