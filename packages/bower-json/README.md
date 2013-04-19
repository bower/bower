bower-json

----------------

Read `bower.json` files with semantics, normalisation, defaults and validation.


## Usage

#### .read(file, callback)

Reads `file` and applies normalisation, defaults and validation according to the `bower.json` spec.

```js
var bowerJson = require('bower-json');

bowerJson.read('/path/to/bower.json', function (err, json) {
    if (err) {
        console.error('There was an error reading the file');
        console.error(err.message);
        return;
    }

    console.log('JSON: ', json);
});

// Can also be used by simply calling bowerJson()

```


#### .parse(json, callback)

Parses an object. Useful when you want to apply normalisation, defaults and validation
directly to an object.

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
