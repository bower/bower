var fs = require('fs'),
    path = require('path');

var defaultConfig = {
  directory: 'components', 
  json:      'component.json',
  endpoint:  'https://bower.herokuapp.com'
}

function existsSync() {
    var obj = fs.existsSync ? fs : path;
    return obj.existsSync.apply(obj, arguments);
}

function loadAndParseConfig(filePath) {
    return filePath && existsSync(filePath) ?
            JSON.parse(fs.readFileSync(filePath, "utf-8")) : {};
}

/**
 * This function searches for a file with a specified name, it starts
 * with the dir passed, and traverses up the filesystem until it either
 * finds the file, or hits the root
 *
 * @param {String} name  Filename to search for (.bowerrc)
 * @param {String} dir   Defaults to process.cwd()
 */
function searchFile(name, dir) {
    dir = dir || process.cwd();

    var filename = path.normalize(path.join(dir, name)),
        parent = path.resolve(dir, "..");

    if (existsSync(filename)) {
        return filename;
    }

    return dir === parent ? null : searchFile(name, parent);
}

function getBowerConfig() {

	// Load the correct .bowerrc file, Order : 1. Current Project Directory, 2. User's Home Directory, 3. Default Config

	var name = ".bowerrc",
        projectConfig = searchFile(name),
        home_path = (process.platform === "win32" ? process.env.USERPROFILE : process.env.HOME),
        homeConfig = path.normalize(path.join(home_path, name));

    // If Project Config is present    
    if (projectConfig) {
    	config = loadAndParseConfig(projectConfig);
        return config;
    }

    // If no project config, check $HOME
    if (existsSync(homeConfig)) {
    	config = loadAndParseConfig(homeConfig);
        return config;
    }

   	// If no Project/Home Config return Default Bower Config
    return defaultConfig;

}

/**
 * This function returns the Bower Config.
 */
module.exports = getBowerConfig;
