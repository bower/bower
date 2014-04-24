# Bower [![Build Status](https://travis-ci.org/bower/bower.svg?branch=master)](https://travis-ci.org/bower/bower)

<img align="right" height="300" src="http://bower.io/img/bower-logo.png">

> A package manager for the web

It offers a generic, unopinionated solution to the problem of **front-end package management**, while exposing the package dependency model via an API that can be consumed by a more opinionated build stack. There are no system wide dependencies, no dependencies are shared between different apps, and the dependency tree is flat.

Bower runs over Git, and is package-agnostic. A packaged component can be made up of any type of asset, and use any type of transport (e.g., AMD, CommonJS, etc.).

[View all packages available through Bower's registry](http://bower.io/search/).


## Install

```sh
$ npm install -g bower
```

Bower depends on [Node.js](http://nodejs.org/) and [npm](http://npmjs.org/). Also make sure that [git](http://git-scm.com/) is installed as some bower
packages require it to be fetched and installed.


## Usage

Much more information is available via `bower help` once it's installed. This
is just enough to get you started.

### Installing packages and dependencies

Bower offers several ways to install packages:

##### Using the dependencies listed in the current directory's bower.json

```sh
$ bower install
```

##### Using a local or remote package

```sh
$ bower install <package>
```

##### Using a specific version of a package

```sh
$ bower install <package>#<version>
```

##### Using a different name and a specific version of a package

```sh
$ bower install <name>=<package>#<version>
```

Where `<package>` can be any one of the following:

* A name that maps to a package registered with Bower, e.g, `jquery`. ‡
* A public remote Git endpoint, e.g., `git://github.com/someone/some-package.git`. ‡
* A private Git repository, e.g., `https://github.com/someone/some-package.git`. If the protocol is https, a prompt will ask for the credentials. ssh can also be used, e.g., `git@github.com:someone/some-package.git` and can authenticate with the user's ssh public/private keys. ‡
* A local endpoint, i.e., a folder that's a Git repository. ‡
* A public remote Subversion endpoint, e.g., `svn+http://package.googlecode.com/svn/`. ‡
* A private Subversion repository, e.g., `svn+ssh://package.googlecode.com/svn/` or `svn+https://package.googlecode.com/svn/`. ‡
* A local endpoint, i.e., a folder that's an Subversion repository, e.g., `svn+file:///path/to/svn/`. ‡
* A shorthand endpoint, e.g., `someone/some-package` (defaults to GitHub). ‡
* A URL to a file, including `zip` and `tar` files. Its contents will be
  extracted.

‡ These types of `<package>` might have versions available. You can specify a
[semver](http://semver.org/) compatible version to fetch a specific release, and lock the
package to that version. You can also specify a [range](https://github.com/isaacs/node-semver#ranges) of versions.

If you are using a package that is a git endpoint, you may use any tag, commit SHA,
or branch name as a version. For example: `<package>#<sha>`. Using branches is not
recommended because the HEAD does not reference a fixed commit SHA.

If you are using a package that is a subversion endpoint, you may use any tag, revision number,
or branch name as a version. For example: `<package>#<revision>`.

All package contents are installed in the `bower_components` directory by default.
You should **never** directly modify the contents of this directory.

Using `bower list` will show all the packages that are installed locally.

**N.B.** If you aren't authoring a package that is intended to be consumed by
others (e.g., you're building a web app), you should always [check installed
packages into source control](http://addyosmani.com/blog/checking-in-front-end-dependencies/).


### Custom install directory

A custom install location can be set in a `.bowerrc` file using the `directory` property. The .bowerrc file should be a sibling of your project's bower.json.

```json
{
  "directory": "app/components"
}
```


### Finding packages

To search for packages registered with Bower:

```sh
$ bower search [<name>]
```

Using just `bower search` will list all packages in the registry.

### Using packages

We discourage using bower components statically for performance and security reasons (if component has an `upload.php` file that is not ignored, that can be easily exploited to do malicious stuff).

The best approach is to process components installed by bower with build tool (like [Grunt](http://gruntjs.com/) or [gulp](http://gulpjs.com/)), and serve them concatenated or using module loader (like [RequireJS](http://requirejs.org/)).

### Uninstalling packages

To uninstall a locally installed package:

```sh
$ bower uninstall <package-name>
```


#### Warning

On `prezto` or `oh-my-zsh`, do not forget to `alias bower='noglob bower'` or `bower install jquery\#1.9.1`

#### Running commands with sudo

Bower is a user command, there is no need to execute it with superuser permissions.
However, if you still want to run commands with sudo, use `--allow-root` option.

#### A note for Windows users

To use Bower on Windows, you must install
[msysgit](http://msysgit.github.io/) correctly. Be sure to check the
option shown below:

![msysgit](http://f.cl.ly/items/2V2O3i1p3R2F1r2v0a12/mysgit.png)

Note that if you use TortoiseGit and if Bower keeps asking for your SSH
password, you should add the following environment variable: `GIT_SSH -
C:\Program Files\TortoiseGit\bin\TortoisePlink.exe`. Adjust the `TortoisePlink`
path if needed.

### Using bower's cache

Bower supports installing packages from its local cache (without internet connection), if the packages were installed before.

```sh
$ bower install <package-name> --offline
```

The content of the cache can be listed with:

```sh
$ bower cache list
```

The cache can be cleaned with:

```sh
$ bower cache clean
```

## Configuration

Bower can be configured using JSON in a `.bowerrc` file.

The current spec can be read
[here](https://docs.google.com/document/d/1APq7oA9tNao1UYWyOm8dKqlRP2blVkROYLZ2fLIjtWc/edit#heading=h.4pzytc1f9j8k)
in the `Configuration` section.

## Running on a continuous integration server

Bower will skip some interactive and analytics operations if it finds a `CI` environmental variable set to `true`. You will find that the `CI` variable is already set for you on many continuous integration servers, e.g., [CircleCI](https://circleci.com/docs/environment-variables#basics) and [Travis-CI](http://docs.travis-ci.com/user/ci-environment/#Environment-variables).

You may try to set manually set `CI` variable manually before running your Bower commands. On Mac or Linux, `export CI=true` and on Windows `set CI=true`

### Interactive configuration

If for some reason you are unable to set the `CI` environment variable, you can alternately use the `--config.interactive=false` flag. (`bower install --config.interactive=false`)

## Defining a package

You must create a `bower.json` in your project's root, and specify all of its
dependencies. This is similar to Node's `package.json`, or Ruby's `Gemfile`,
and is useful for locking down a project's dependencies.

*NOTE:* In versions of Bower before 0.9.0 the package metadata file was called
`component.json` rather than `bower.json`. This has changed to avoid a name
clash with another tool. You can still use `component.json` for now but it is
deprecated and the automatic fallback is likely to be removed in an upcoming
release.

You can interactively create a `bower.json` with the following command:

```sh
$ bower init
```

The `bower.json` ([spec](https://github.com/bower/bower.json-spec)) defines several options, including:

* `name` (required): The name of your package.
* `version`: A semantic version number (see [semver](http://semver.org/)).
* `main` [string|array]: The primary endpoints of your package.
* `ignore` [array]: An array of paths not needed in production that you want
  Bower to ignore when installing your package.
* `dependencies` [hash]: Packages your package depends upon in production.
  Note that you can specify [ranges](https://github.com/isaacs/node-semver#ranges)
  of versions for your dependencies.
* `devDependencies` [hash]: Development dependencies.
* `private` [boolean]: Set to true if you want to keep the package private and
  do not want to register the package in future.

```json
{
  "name": "my-project",
  "description": "My project does XYZ...",
  "version": "1.0.0",
  "main": "path/to/main.css",
  "ignore": [
    ".jshintrc",
    "**/*.txt"
  ],
  "dependencies": {
    "<name>": "<version>",
    "<name>": "<folder>",
    "<name>": "<package>"
  },
  "devDependencies": {
    "<test-framework-name>": "<version>"
  }
}
```

### Registering packages

To register a new package:

* There **must** be a valid manifest JSON in the current working directory.
* Your package should use [semver](http://semver.org/) Git tags.
* Your package **must** be available at a Git endpoint (e.g., GitHub); remember
  to push your Git tags!

Then use the following command:

```sh
$ bower register <my-package-name> <git-endpoint>
```

The Bower registry does not have authentication or user management at this point
in time. It's on a first come, first served basis. Think of it like a URL
shortener. Now anyone can run `bower install <my-package-name>`, and get your
library installed.

There is no direct way to unregister a package yet. For now, you can [request a
package be unregistered](https://github.com/bower/bower/issues/120).


## Consuming a package

Bower also makes available a source mapping. This can be used by build tools to
easily consume Bower packages.

If you pass the `--paths` option to Bower's `list` command, you will get a
simple name-to-path mapping:

```json
{
  "backbone": "bower_components/backbone/index.js",
  "jquery": "bower_components/jquery/index.js",
  "underscore": "bower_components/underscore/index.js"
}
```

Alternatively, every command supports the `--json` option that makes bower
output JSON. Command result is outputted to `stdout` and error/logs to
`stderr`.


## Programmatic API

Bower provides a powerful, programmatic API. All commands can be accessed
through the `bower.commands` object.

```js
var bower = require('bower');

bower.commands
.install(['jquery'], { save: true }, { /* custom config */ })
.on('end', function (installed) {
    console.log(installed);
});

bower.commands
.search('jquery', {})
.on('end', function (results) {
    console.log(results);
});
```

Commands emit four types of events: `log`, `prompt`, `end`, `error`.

* `log` is emitted to report the state/progress of the command.
* `prompt` is emitted whenever the user needs to be prompted.
* `error` will only be emitted if something goes wrong.
* `end` is emitted when the command successfully ends.

For a better of idea how this works, you may want to check out [our bin
file](https://github.com/bower/bower/blob/master/bin/bower).

When using bower programmatically, prompting is disabled by default. Though you can enable it when calling commands with `interactive: true` in the config.
This requires you to listen for the `prompt` event and handle the prompting yourself. The easiest way is to use the [inquirer](https://npmjs.org/package/inquirer) npm module like so:

```js
var inquirer =  require('inquirer');

bower.commands
.install(['jquery'], { save: true }, { interactive: true })
// ..
.on('prompt', function (prompts, callback) {
    inquirer.prompt(prompts, callback);
});
```


## Completion (experimental)

_NOTE_: Completion is still not implemented for the 1.0.0 release

Bower now has an experimental `completion` command that is based on, and works
similarly to the [npm completion](https://npmjs.org/doc/completion.html). It is
not available for Windows users.

This command will output a Bash / ZSH script to put into your `~/.bashrc`,
`~/.bash_profile`, or `~/.zshrc` file.

```sh
$ bower completion >> ~/.bash_profile
```


## Support

* [StackOverflow](http://stackoverflow.com/questions/tagged/bower)
* [Mailinglist](http://groups.google.com/group/twitter-bower) - twitter-bower@googlegroups.com
* [\#bower](http://webchat.freenode.net/?channels=bower) on Freenode


## Contributing

We welcome contributions of all kinds from anyone. Please take a moment to
review the [guidelines for contributing](CONTRIBUTING.md).

* [Bug reports](CONTRIBUTING.md#bugs)
* [Feature requests](CONTRIBUTING.md#features)
* [Pull requests](CONTRIBUTING.md#pull-requests)


## Bower Team

### Core team

* [@satazor](https://github.com/satazor)
* [@wibblymat](https://github.com/wibblymat)
* [@paulirish](https://github.com/paulirish)
* [@benschwarz](https://github.com/benschwarz)
* [@sindresorhus](https://github.com/sindresorhus)
* [@svnlto](https://github.com/svnlto)
* [@sheerun](https://github.com/sheerun)

Thanks for assistance and contributions:

[@addyosmani](https://github.com/addyosmani),
[@ahmadnassri](https://github.com/ahmadnassri),
[@angus-c](https://github.com/angus-c),
[@borismus](https://github.com/borismus),
[@carsonmcdonald](https://github.com/carsonmcdonald),
[@chriseppstein](https://github.com/chriseppstein),
[@danwrong](https://github.com/danwrong),
[@davidmaxwaterman](https://github.com/davidmaxwaterman),
[@desandro](https://github.com/desandro),
[@hemanth](https://github.com/hemanth),
[@isaacs](https://github.com/isaacs),
[@josh](https://github.com/josh),
[@jrburke](https://github.com/jrburke),
[@kennethklee](https://github.com/kennethklee),
[@marcelombc](https://github.com/marcelombc),
[@marcooliveira](https://github.com/marcooliveira),
[@mklabs](https://github.com/mklabs),
[@MrDHat](https://github.com/MrDHat),
[@necolas](https://github.com/necolas),
[@richo](https://github.com/richo),
[@rvagg](https://github.com/rvagg),
[@ryanflorence](https://github.com/ryanflorence),
[@SlexAxton](https://github.com/SlexAxton),
[@sstephenson](https://github.com/sstephenson),
[@tomdale](https://github.com/tomdale),
[@uzquiano](https://github.com/uzquiano),
[@visionmedia](https://github.com/visionmedia),
[@wagenet](https://github.com/wagenet),
[@wycats](https://github.com/wycats)

### Bower Alumni

* [@fat](https://github.com/fat)
* [@maccman](https://github.com/maccman)


## License

Copyright (c) 2014 Twitter and other contributors

Licensed under the MIT License
