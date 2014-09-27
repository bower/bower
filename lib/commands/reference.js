var cli = require('../util/cli');
var fs = require('fs');
var createError = require('../util/createError');
require('linqjs');

function reference(logger, packageName, viewPath) {
    try{
        var html = fs.readFileSync(viewPath).toString();
        var cssFilesToImport = [];
        var jsFilesToImport = [];

        logger.info('init', 'Referencing package ' + packageName + ' to file ' + viewPath);

        _getFilesToImportByPackageName(packageName, cssFilesToImport, jsFilesToImport);

        html = _importJsToHtml(html, jsFilesToImport);
        html = _importCssToHtml(html, cssFilesToImport);

        _writeHtmlFile(html, viewPath);

        logger.info('done', 'Package referenced with success.');
    }catch(err){
        createError(err, 'EWORKING');
    }
}

function _getFilesByType(filePathList, type){
    return filePathList.where(function(f){
        return f.indexOf(type) > -1;
    });
}

function _getFilesToImport(packageName, mainFiles, cssFilesToImport, jsFilesToImport){
    mainFiles = typeof(mainFiles) == 'object' ? mainFiles : [mainFiles];

    _getFilesByType(mainFiles, '.css').forEach(function(f){
        cssFilesToImport.unshift(packageName + '/' + f.replace('../', '').replace('./', ''));
    });
    _getFilesByType(mainFiles, '.js').forEach(function(f){
        jsFilesToImport.unshift(packageName + '/' + f.replace('../', '').replace('./', ''));
    });
}

function _getBowerFileByPackageName(packageName){
    return JSON.parse(fs.readFileSync('./bower_components/' + packageName + '/bower.json').toString());
}

function _getFilesDependenciesToImport(bowerfile, cssFilesToImport, jsFilesToImport){
    var dependencies = bowerfile.dependencies;
    if(!dependencies)
        return;

    for(var packageName in dependencies){
        _getFilesToImportByPackageName(packageName, cssFilesToImport, jsFilesToImport);
    }
}

function _getFilesToImportByPackageName(packageName, cssFilesToImport, jsFilesToImport){
    var bowerfile = _getBowerFileByPackageName(packageName);
    var mainFiles = bowerfile.main;

    _getFilesToImport(packageName, mainFiles, cssFilesToImport, jsFilesToImport);
    _getFilesDependenciesToImport(bowerfile, cssFilesToImport, jsFilesToImport);
}

function _getJsScriptTemplate(pos, file, withSpaces){
    var _template = '<script type='text/javascript' src='bower_components/' + file + ''></script>';

    if(withSpaces)
        return '    ' + _template;
    else
        return _template;
}

function _importJsToHtml(html, jsFiles){
    if(typeof(html) === 'undefined')
        return;

    for(var pos in jsFiles){
        if(!jsFiles.hasOwnProperty(pos))
            continue;

        var file = jsFiles[pos];
        if(html.indexOf('</body>') > -1){
            html = html.replace('</body>', _getJsScriptTemplate(pos, file, true) + '\n</body>');
        }else{
            html = _getJsScriptTemplate(pos, file, false) + '\n' + html;
        }
    }

    return html;
}

function _getCssScriptTemplate(pos, file, withSpaces){
    var _template = '<link rel='stylesheet' type='text/css' hreference='bower_components/' + file + '' />';

    if(withSpaces)
        return '    ' + _template;
    else
        return _template;
}

function _importCssToHtml(html, cssFiles){
    if(typeof(html) === 'undefined')
        return;

    for(var pos in cssFiles){
        if(!cssFiles.hasOwnProperty(pos))
            continue;

        var file = cssFiles[pos];
        if(html.indexOf('</head>') > -1){
            html = html.replace('</head>', _getCssScriptTemplate(pos, file, true) + '\n</head>');
        }else{
            html = _getCssScriptTemplate(pos, file, false) + '\n' + html;
        }
    }

    return html;
}

function _writeHtmlFile(html, path){
    fs.writeFileSync(path, html, 'utf8');
}

reference.line = function (logger, argv) {
    var options = cli.readOptions(argv);
    var packageName = options.argv.remain[1];
    var viewPath = options.argv.remain[2];

    return reference(logger, packageName, viewPath);
};

reference.completion = function () {
    // TODO:
};

module.exports = reference;