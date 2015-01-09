describe('integration tests', function () {
    require('./cache/list');
    require('./cache/clean');
    require('./help');
    require('./home');
    require('./info');
    require('./init');
    require('./install');
    require('./list');
    require('./link');
    require('./prune');
    require('./register');
    require('./uninstall');
    require('./update');
    require('./version');
    // run last because it changes defaults
    require('./bower');
});
