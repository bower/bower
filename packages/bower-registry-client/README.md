# bower-courier

A messenger, usually travelling in haste, bearing urgent news, important reports or packages, diplomatic messages, etc.   
This module allows you to interact with the Bower server API.


## Usage

#### .lookup(name, options, callback)

Looks the package `name`, giving you the associated registered URL.
The `options` argument is optional.

```js
var courier = require('bower-courier');

// Can also be used by simply calling bowerJson()
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