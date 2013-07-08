# bower-json [![Build Status](https://secure.travis-ci.org/bower/json.png?branch=master)](http://travis-ci.org/bower/json)

Read `bower.json` files with semantics, normalisation, defaults and validation.


## Usage

#### .read(file, callback)

Reads `file` and applies normalisation, defaults and validation according to the `bower.json` spec.   
If the passed `file` does not exist, the callback is called with `error.code` equal to `ENOENT`.   
If the passed `file` contents are not valid JSON, the callback is called with `error.code` equal to `EMALFORMED`.   
If the `json` does not comply with the `bower.json` spec, the callback is called with `error.code` equal to `EINVALID`.

```js
var bowerJson = require('bower-json');

// Can also be used by simply calling bowerJson()
bowerJson.read('/path/to/bower.json', function (err, json) {
    if (err) {
        console.error('There was an error reading the file');
        console.error(err.message);
        return;
    }

    console.log('JSON: ', json);
});
```


#### .parse(json, callback)

Parses an object. Useful when you want to apply normalisation, defaults and validation directly to an object.   
If the `json` does not comply with the `bower.json` spec, the callback is called with `error.code` equal to `EINVALID`.

```js
var bowerJson = require('bower-json');

var json = {
    name: 'my-package',
    version: '0.0.1'
};

bowerJson.parse(json, function (err, json) {
    if (err) {
        console.error('There was an error parsing the object');
        console.error(err.message);
        return;
    }

    console.log('Parsed: ', json);
});
```


#### .find(folder, callback)

Finds the `json` filename inside a folder.   
Checks if a `bower.json` exists, falling back to the deprecated `component.json`.   
If no file was found, the callback is called with a `error.code` of `ENOENT`.

```js
var bowerJson = require('bower-json');

bowerJson.find('/path/to/folder', function (err, filename) {
    if (err) {
        console.error('There is no json file in the folder');
        return;
    }

    console.log('Filename: ', filename);

    // Now that we got the filename, we can read its contents
    bowerJson.read(filename, function (err, json) {
        if (err) {
            console.error('There was an error reading the file');
            console.error(err.message);
            return;
        }

        console.log('JSON: ', json);
    });
});
```


## License

Released under the [MIT License](http://www.opensource.org/licenses/mit-license.php).
