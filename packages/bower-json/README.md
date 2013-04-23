# bower-json

Read `bower.json` files with semantics, normalisation, defaults and validation.


## Usage

#### .read(file, callback)

Reads `file` and applies normalisation, defaults and validation according to the `bower.json` spec.   
If the passed `file` does not exists, the callback is called with a `error.code` of `ENOENT`.   
If the passed `file` contents are not a valid JSON, the callback is called a `error.code` of `EMALFORMED`.
If the passed 
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
If the `json` is invalid, the callback is called with a `error.code` of `EINVALID`.

```js
var bowerJson = require('bower-json');

var json = {
    name: 'my-package',
    version: '0.0.1'
};

bowerJson.parse(json, function (err, filename) {
    if (err) {
        console.error('There was an error parsing the object');
        console.error(err.message);
        return;
    }

    console.log('JSON: ', json);
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
    bowerJson.read(filename, function () {
        if (err) {
            console.error('There was an error reading the file');
            console.error(err.message);
            return;
        }

        console.log('JSON: ', json);
    });
});
```
