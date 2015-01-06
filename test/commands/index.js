describe('integration tests', function () {
    require('./help');
    require('./home');
    require('./info');
    require('./init');
    require('./install');
    require('./list');
    require('./register');
    require('./uninstall');
    require('./update');
    // run last because it changes defaults
    require('./bower');
});
