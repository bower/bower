# Bower - A package manager for the web

[![Backers on Open Collective](https://opencollective.com/bower/backers/badge.svg)](#backers)
[![Sponsors on Open Collective](https://opencollective.com/bower/sponsors/badge.svg)](#sponsors)

> ..psst! While Bower is maintained, we recommend [yarn](https://yarnpkg.com/) and [webpack](https://webpack.js.org/) for new front-end projects!

[![Unix CI](https://img.shields.io/travis/bower/bower/master.svg?maxAge=2592000)](https://travis-ci.org/bower/bower)
[![Windows CI](https://img.shields.io/appveyor/ci/bower/bower/master.svg)](https://ci.appveyor.com/project/bower/bower)
[![Coverage Status](https://img.shields.io/coveralls/bower/bower.svg)](https://coveralls.io/r/bower/bower?branch=master)
[![Discord chat](https://img.shields.io/badge/discord-join%20chat%20%E2%86%92-brightgreen.svg?style=flat)](https://discord.gg/0fFM7QF0KpZRh2cY)

<img align="right" height="300" src="http://bower.io/img/bower-logo.png">

---

Bower offers a generic, unopinionated solution to the problem of **front-end package management**, while exposing the package dependency model via an API that can be consumed by a more opinionated build stack. There are no system wide dependencies, no dependencies are shared between different apps, and the dependency tree is flat.

Bower runs over Git, and is package-agnostic. A packaged component can be made up of any type of asset, and use any type of transport (e.g., AMD, CommonJS, etc.).

**View complete docs on [bower.io](http://bower.io)**

[View all packages available through Bower's registry](http://bower.io/search/).

## Install

```sh
$ npm install -g bower
```

Bower depends on [Node.js](http://nodejs.org/) and [npm](http://npmjs.org/). Also make sure that [git](http://git-scm.com/) is installed as some bower
packages require it to be fetched and installed.


## Usage

See complete command line reference at [bower.io/docs/api/](http://bower.io/docs/api/)

### Installing packages and dependencies

```sh
# install dependencies listed in bower.json
$ bower install

# install a package and add it to bower.json
$ bower install <package> --save

# install specific version of a package and add it to bower.json
$ bower install <package>#<version> --save
```

### Using packages

We discourage using bower components statically for performance and security reasons (if component has an `upload.php` file that is not ignored, that can be easily exploited to do malicious stuff).

The best approach is to process components installed by bower with build tool (like [Grunt](http://gruntjs.com/) or [gulp](http://gulpjs.com/)), and serve them concatenated or using a module loader (like [RequireJS](http://requirejs.org/)).

### Uninstalling packages

To uninstall a locally installed package:

```sh
$ bower uninstall <package-name>
```

### prezto and oh-my-zsh users

On `prezto` or `oh-my-zsh`, do not forget to `alias bower='noglob bower'` or `bower install jquery\#1.9.1`

### Never run Bower with sudo

Bower is a user command; there is no need to execute it with superuser permissions.

### Windows users

To use Bower on Windows, you must install
[Git for Windows](http://git-for-windows.github.io/) correctly. Be sure to check the
options shown below:

<img src="https://cloud.githubusercontent.com/assets/10702007/10532690/d2e8991a-7386-11e5-9a57-613c7f92e84e.png" width="534" height="418" alt="Git for Windows" />

<img src="https://cloud.githubusercontent.com/assets/10702007/10532694/dbe8857a-7386-11e5-9bd0-367e97644403.png" width="534" height="418" alt="Git for Windows" />

Note that if you use TortoiseGit and if Bower keeps asking for your SSH
password, you should add the following environment variable: `GIT_SSH -
C:\Program Files\TortoiseGit\bin\TortoisePlink.exe`. Adjust the `TortoisePlink`
path if needed.

### Ubuntu users

To use Bower on Ubuntu, you might need to link `nodejs` executable to `node`:

```
sudo ln -s /usr/bin/nodejs /usr/bin/node
```

## Configuration

Bower can be configured using JSON in a `.bowerrc` file. Read over available options at [bower.io/docs/config](http://bower.io/docs/config).


## Support

* [Discord chat](https://discord.gg/0fFM7QF0KpZRh2cY)
* [StackOverflow](http://stackoverflow.com/questions/tagged/bower)
* [Mailinglist](http://groups.google.com/group/twitter-bower) - twitter-bower@googlegroups.com

## Contributing

We welcome [contributions](https://github.com/bower/bower/graphs/contributors) of all kinds from anyone. Please take a moment to review the [guidelines for contributing](CONTRIBUTING.md).

* [Bug reports](https://github.com/bower/bower/wiki/Report-a-Bug)
* [Feature requests](CONTRIBUTING.md#features)
* [Pull requests](CONTRIBUTING.md#pull-requests)


Note that on Windows for tests to pass you need to configure Git before cloning:

```
git config --global core.autocrlf input
```


## Backers

Support us with a monthly donation and help us continue our activities. [[Become a backer](https://opencollective.com/bower#backer)]

<a href="https://opencollective.com/bower/backer/0/website" target="_blank"><img src="https://opencollective.com/bower/backer/0/avatar.svg"></a>
<a href="https://opencollective.com/bower/backer/1/website" target="_blank"><img src="https://opencollective.com/bower/backer/1/avatar.svg"></a>
<a href="https://opencollective.com/bower/backer/2/website" target="_blank"><img src="https://opencollective.com/bower/backer/2/avatar.svg"></a>
<a href="https://opencollective.com/bower/backer/3/website" target="_blank"><img src="https://opencollective.com/bower/backer/3/avatar.svg"></a>
<a href="https://opencollective.com/bower/backer/4/website" target="_blank"><img src="https://opencollective.com/bower/backer/4/avatar.svg"></a>
<a href="https://opencollective.com/bower/backer/5/website" target="_blank"><img src="https://opencollective.com/bower/backer/5/avatar.svg"></a>
<a href="https://opencollective.com/bower/backer/6/website" target="_blank"><img src="https://opencollective.com/bower/backer/6/avatar.svg"></a>
<a href="https://opencollective.com/bower/backer/7/website" target="_blank"><img src="https://opencollective.com/bower/backer/7/avatar.svg"></a>
<a href="https://opencollective.com/bower/backer/8/website" target="_blank"><img src="https://opencollective.com/bower/backer/8/avatar.svg"></a>
<a href="https://opencollective.com/bower/backer/9/website" target="_blank"><img src="https://opencollective.com/bower/backer/9/avatar.svg"></a>
<a href="https://opencollective.com/bower/backer/10/website" target="_blank"><img src="https://opencollective.com/bower/backer/10/avatar.svg"></a>
<a href="https://opencollective.com/bower/backer/11/website" target="_blank"><img src="https://opencollective.com/bower/backer/11/avatar.svg"></a>
<a href="https://opencollective.com/bower/backer/12/website" target="_blank"><img src="https://opencollective.com/bower/backer/12/avatar.svg"></a>
<a href="https://opencollective.com/bower/backer/13/website" target="_blank"><img src="https://opencollective.com/bower/backer/13/avatar.svg"></a>
<a href="https://opencollective.com/bower/backer/14/website" target="_blank"><img src="https://opencollective.com/bower/backer/14/avatar.svg"></a>
<a href="https://opencollective.com/bower/backer/15/website" target="_blank"><img src="https://opencollective.com/bower/backer/15/avatar.svg"></a>
<a href="https://opencollective.com/bower/backer/16/website" target="_blank"><img src="https://opencollective.com/bower/backer/16/avatar.svg"></a>
<a href="https://opencollective.com/bower/backer/17/website" target="_blank"><img src="https://opencollective.com/bower/backer/17/avatar.svg"></a>
<a href="https://opencollective.com/bower/backer/18/website" target="_blank"><img src="https://opencollective.com/bower/backer/18/avatar.svg"></a>
<a href="https://opencollective.com/bower/backer/19/website" target="_blank"><img src="https://opencollective.com/bower/backer/19/avatar.svg"></a>
<a href="https://opencollective.com/bower/backer/20/website" target="_blank"><img src="https://opencollective.com/bower/backer/20/avatar.svg"></a>
<a href="https://opencollective.com/bower/backer/21/website" target="_blank"><img src="https://opencollective.com/bower/backer/21/avatar.svg"></a>
<a href="https://opencollective.com/bower/backer/22/website" target="_blank"><img src="https://opencollective.com/bower/backer/22/avatar.svg"></a>
<a href="https://opencollective.com/bower/backer/23/website" target="_blank"><img src="https://opencollective.com/bower/backer/23/avatar.svg"></a>
<a href="https://opencollective.com/bower/backer/24/website" target="_blank"><img src="https://opencollective.com/bower/backer/24/avatar.svg"></a>
<a href="https://opencollective.com/bower/backer/25/website" target="_blank"><img src="https://opencollective.com/bower/backer/25/avatar.svg"></a>
<a href="https://opencollective.com/bower/backer/26/website" target="_blank"><img src="https://opencollective.com/bower/backer/26/avatar.svg"></a>
<a href="https://opencollective.com/bower/backer/27/website" target="_blank"><img src="https://opencollective.com/bower/backer/27/avatar.svg"></a>
<a href="https://opencollective.com/bower/backer/28/website" target="_blank"><img src="https://opencollective.com/bower/backer/28/avatar.svg"></a>
<a href="https://opencollective.com/bower/backer/29/website" target="_blank"><img src="https://opencollective.com/bower/backer/29/avatar.svg"></a>


## Sponsors

Become a sponsor and get your logo on our README on Github with a link to your site. [[Become a sponsor](https://opencollective.com/bower#sponsor)]

<a href="https://opencollective.com/bower/sponsor/0/website" target="_blank"><img src="https://opencollective.com/bower/sponsor/0/avatar.svg"></a>
<a href="https://opencollective.com/bower/sponsor/1/website" target="_blank"><img src="https://opencollective.com/bower/sponsor/1/avatar.svg"></a>
<a href="https://opencollective.com/bower/sponsor/2/website" target="_blank"><img src="https://opencollective.com/bower/sponsor/2/avatar.svg"></a>
<a href="https://opencollective.com/bower/sponsor/3/website" target="_blank"><img src="https://opencollective.com/bower/sponsor/3/avatar.svg"></a>
<a href="https://opencollective.com/bower/sponsor/4/website" target="_blank"><img src="https://opencollective.com/bower/sponsor/4/avatar.svg"></a>
<a href="https://opencollective.com/bower/sponsor/5/website" target="_blank"><img src="https://opencollective.com/bower/sponsor/5/avatar.svg"></a>
<a href="https://opencollective.com/bower/sponsor/6/website" target="_blank"><img src="https://opencollective.com/bower/sponsor/6/avatar.svg"></a>
<a href="https://opencollective.com/bower/sponsor/7/website" target="_blank"><img src="https://opencollective.com/bower/sponsor/7/avatar.svg"></a>
<a href="https://opencollective.com/bower/sponsor/8/website" target="_blank"><img src="https://opencollective.com/bower/sponsor/8/avatar.svg"></a>
<a href="https://opencollective.com/bower/sponsor/9/website" target="_blank"><img src="https://opencollective.com/bower/sponsor/9/avatar.svg"></a>
<a href="https://opencollective.com/bower/sponsor/10/website" target="_blank"><img src="https://opencollective.com/bower/sponsor/10/avatar.svg"></a>
<a href="https://opencollective.com/bower/sponsor/11/website" target="_blank"><img src="https://opencollective.com/bower/sponsor/11/avatar.svg"></a>
<a href="https://opencollective.com/bower/sponsor/12/website" target="_blank"><img src="https://opencollective.com/bower/sponsor/12/avatar.svg"></a>
<a href="https://opencollective.com/bower/sponsor/13/website" target="_blank"><img src="https://opencollective.com/bower/sponsor/13/avatar.svg"></a>
<a href="https://opencollective.com/bower/sponsor/14/website" target="_blank"><img src="https://opencollective.com/bower/sponsor/14/avatar.svg"></a>
<a href="https://opencollective.com/bower/sponsor/15/website" target="_blank"><img src="https://opencollective.com/bower/sponsor/15/avatar.svg"></a>
<a href="https://opencollective.com/bower/sponsor/16/website" target="_blank"><img src="https://opencollective.com/bower/sponsor/16/avatar.svg"></a>
<a href="https://opencollective.com/bower/sponsor/17/website" target="_blank"><img src="https://opencollective.com/bower/sponsor/17/avatar.svg"></a>
<a href="https://opencollective.com/bower/sponsor/18/website" target="_blank"><img src="https://opencollective.com/bower/sponsor/18/avatar.svg"></a>
<a href="https://opencollective.com/bower/sponsor/19/website" target="_blank"><img src="https://opencollective.com/bower/sponsor/19/avatar.svg"></a>
<a href="https://opencollective.com/bower/sponsor/20/website" target="_blank"><img src="https://opencollective.com/bower/sponsor/20/avatar.svg"></a>
<a href="https://opencollective.com/bower/sponsor/21/website" target="_blank"><img src="https://opencollective.com/bower/sponsor/21/avatar.svg"></a>
<a href="https://opencollective.com/bower/sponsor/22/website" target="_blank"><img src="https://opencollective.com/bower/sponsor/22/avatar.svg"></a>
<a href="https://opencollective.com/bower/sponsor/23/website" target="_blank"><img src="https://opencollective.com/bower/sponsor/23/avatar.svg"></a>
<a href="https://opencollective.com/bower/sponsor/24/website" target="_blank"><img src="https://opencollective.com/bower/sponsor/24/avatar.svg"></a>
<a href="https://opencollective.com/bower/sponsor/25/website" target="_blank"><img src="https://opencollective.com/bower/sponsor/25/avatar.svg"></a>
<a href="https://opencollective.com/bower/sponsor/26/website" target="_blank"><img src="https://opencollective.com/bower/sponsor/26/avatar.svg"></a>
<a href="https://opencollective.com/bower/sponsor/27/website" target="_blank"><img src="https://opencollective.com/bower/sponsor/27/avatar.svg"></a>
<a href="https://opencollective.com/bower/sponsor/28/website" target="_blank"><img src="https://opencollective.com/bower/sponsor/28/avatar.svg"></a>
<a href="https://opencollective.com/bower/sponsor/29/website" target="_blank"><img src="https://opencollective.com/bower/sponsor/29/avatar.svg"></a>


## License

Copyright (c) 2012-present Twitter and [other contributors](https://github.com/bower/bower/graphs/contributors)

Licensed under the MIT License
