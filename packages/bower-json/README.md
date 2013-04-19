read-bower-json

----------------

Read `bower.json` files with semantics, normalisation, defaults and validation.


## Usage

#### readJson(file, callback)

Reads `file` and applies normalisation, defaults and validation according to the `bower.json` spec.

```js
// Reads the `json` file.
readJson('/path/to/bower.json', function (err, json) {
    if (err) {
        console.error('There was an error reading the file');
        console.error(err.message);
        return;
    }

    console.log('JSON: ', json);
});

```


#### readJson.parse(json, callback)

Parses an object as `json` file. Useful when you want to apply normalisation, defaults and validation
directly to an object.

```js
var readJson = require('read-bower-json');

var json = {
    name: 'my-package',
    version: '0.0.1'
};

readJson.parse(json, function (err, filename) {
    if (err) {
        console.error('There was an error parsing the object');
        console.error(err.message);
        return;
    }

    console.log('JSON: ', json);
});
```


#### readJson.find(folder, callback)

Finds the `json` filename inside a folder.   
Checks if a `bower.json` exists, falling back to the deprecated `component.json`.   

```js
var readJson = require('read-bower-json');

readJson.find('/path/to/folder', function (err, filename) {
    if (err) {
        console.error('There is no json file in the folder');
        return;
    }

    console.log('Filename: ', filename);

    // Read its contents
    readJson(filename, function () {
        if (err) {
            console.error('There was an error reading the file');
            console.error(err.message);
            return;
        }

        console.log('JSON: ', json);
    });
});
```
