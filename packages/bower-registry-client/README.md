# bower-courier [![Build Status](https://secure.travis-ci.org/bower/courier.png?branch=master)](http://travis-ci.org/bower/courier)

*A messenger, usually travelling in haste, bearing urgent news, important reports or packages, diplomatic messages, etc.*   
This module allows you to easily interact with the Bower server API.


## Usage

#### .lookup(name, options, callback)

Looks the package `name`, giving you the associated registered URL.   
The `options` argument is optional.

Available options:
- registry: an array of registry search endpoints (defaults to the Bower server)
- skipCache: true to skip lookup cache (defaults to false)
- timeout: the timeout for the requests to finish (defaults to 5000)

```js
var courier = require('bower-courier');

courier.lookup(name, function (err, url) {
    if (err) {
        console.error(err.message);
        return;
    }

    console.log('URL: ', url);
});
```

#### .register(name, url, options, callback)

#### .search(str, options, callback)

#### .info(name, options, callback)