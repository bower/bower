# bower-config

> The Bower config (`.bowerrc`) reader and writer.

[Bower](http://bower.io/) can be configured using JSON in a `.bowerrc` file. For example:

    {
      "directory": "app/components/",
      "timeout": 120000,
      "registry": {
        "search": [
          "http://localhost:8000",
          "https://registry.bower.io"
        ]
      }
    }

View the complete [.bowerrc specification](http://bower.io/docs/config/#bowerrc-specification) on the website for more details. Both the `bower.json` and `.bowerrc` specifications are maintained at [github.com/bower/spec](https://github.com/bower/spec).

## Install

```sh
$ npm install --save bower-config
```


## Usage

#### .load(overwrites)

Loads the bower configuration from the configuration files.

Configuration is overwritten (after camelcase normalisation) with `overwrites` argument.

This method overwrites following environment variables:

- `HTTP_PROXY` with `proxy` configuration variable
- `HTTPS_PROXY` with `https-proxy` configuration variable
- `NO_PROXY` with `no-proxy` configuration variable

It also clears `http_proxy`, `https_proxy`, and `no_proxy` environment variables.

To restore those variables you can use `restore` method.

#### restore()

Restores environment variables overwritten by `.load` method.

#### .toObject()

Returns a deep copy of the underlying configuration object.
The returned configuration is normalised.
The object keys will be camelCase.


#### #create(cwd)

Obtains a instance where `cwd` is the current working directory (defaults to `process.cwd`);

```js
var config = require('bower-config').create();
// You can also specify a working directory
var config2 = require('bower-config').create('./some/path');
```

#### #read(cwd, overrides)

Alias for:

```js
var configObject = (new Config(cwd)).load(overrides).toJson();
```

## License

Released under the [MIT License](http://www.opensource.org/licenses/mit-license.php).
