# bower-registry-client [![Build Status](https://secure.travis-ci.org/bower/registry-client.png?branch=master)](http://travis-ci.org/bower/registry-client)

This module allows you to easily interact with the Bower server API.


## Usage

```js

var RegistryClient = require('bower-registry-client');
var registry = new RegistryClient(options);
```

Available constructor options:

- registry.search: an array of registry search endpoints (defaults to the Bower server)
- registry.register: the endpoint to use when registering packages (defaults to the Bower server)
- registry.publish: the endpoint to use when publishing packages (defaults to the Bower server)
- ca.search: an array of CA certificates for each registry.search (defaults to null).
- ca.register: the CA certificate for registry.register
- ca.publish: the CA certificate for registry.publish
- proxy: the proxy to use for http requests (defaults to null)
- httpsProxy: the proxy to use for https requests (defaults to null)
- strictSsl: whether or not to do SSL key validation when making requests via https (defaults to true).
- userAgent: the user agent to use for the requests (defaults to null)
- cache: the cache folder to use for some operations; using null will disable cache (defaults to OS temp folder)
- timeout: the timeout for the requests to finish (defaults to 5000)

The cache will speedup operations such as `lookup` and `info`.
Different operations may have different cache expiration times.

#### .lookup(name, force, callback)

Looks the registry for the package `name`, giving you the associated registered URL.   
The `force` argument is optional and defaults to `false`. If set to `true`, cache will be bypassed and remotes will always be hit.


```js
registry.lookup(name, function (err, url) {
    if (err) {
        console.error(err.message);
        return;
    }

    console.log('URL: ', url);
});
```

#### .register(name, url, callback)

#### .search(str, force, callback)

#### .info(name, force, callback)

#### .clearCache(name, callback)

Clear the cache associated with the `name` package.   
If `name` is null, clears all the cache.

```js
// Clear jquery cache
registry.clearCache('jquery', function (err) {
    if (err) {
        console.error(err.message);
        return;
    }

    console.log('Done');
});

// Clear all cache
registry.clearCache(function (err) {
    if (err) {
        console.error(err.message);
        return;
    }

    console.log('Done');
});
```