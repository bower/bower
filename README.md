# Bower rewrite

This repository is just an experiment around the new bower rewrite.
It will remain private and only trustworthy people will have access to it.
If the general consensus is to advance with it, the code will move to a new branch on the official repository.

## Why?

Bower codebase is becoming unmanageable, especially at its core.
Main issues are:

- ___Monolithic Package.js that handles all package types (GitHub, url, local, etc).___
- ___Package.js has too many nesting level of callbacks, causing confusion and making it hard to read___
- Some commands, such as install and update, have incorrect behaviour (#200, #256)
   - This is directly related with the current implementation of bower core: Package.js and Manager.js
- Programmatic usage needs improvement
  - Some commands simply do not fire the `end` event
  - Others fire the `error` event many times
  - Some commands should fire more meaningful events (e.g.: install should fire each installed package)

## Solution

The rewrite will give a chance to make bower more manageable, solving the issues mentioned above while also improving the overall codebase. Readable code is crucial to increase the number of contributors and to the success of bower.

Solutions to the main issues:

- Polymorphism can be used to make different kind of packages share a common API. Different kind of packages will be implemented separatly but will share common functionality. This will be further explained bellow.
- Promises will resolve the nesting problem found in the codebase.
- TODO
- TODO

## Implementation details

### Package factory
Simple function that takes an endpoint with options and creates an intance of a package that obey the base package interface.

```js
function createPackage(endpoint, options) -> Promise
```

This function could perform transformations/normalizations to the endpoint.
For instance, if `endpoint` is a shorthand it would expand it.
The function is actually async to allow query the bower registry to know the real endpoint.

### Package.js -> EventEmitter

The Package.js class extends EventEmitter.
Think of it as an abstract class that implements the package interface as well as serving as a base for other package types.

#### Events

- name_change (fired when the name of the package has changed)
- action      (fired to inform the current action being performed by the package)

------------

#### Constructor

Package(endpoint, options)

Options:

- name - the package name (if none is passed, one will be guessed from the endpoint)
- range - a valid semver range (defaults to *)
- unitOfWork - the unit of work to use (if none is passed, one will be created)

------------

Public functions

#### Package#getName() -> String
Returns the package name.

#### Package#getEndpoint() -> String
Returns the package endpoint.

#### Package#getRange() -> String
Returns the semver range it should resolve to.

#### Package#getTempDir() -> String
Returns the temporary directory that the package can use to resolve itself.

#### Package#resolve() -> Promise
Resolves the package.
The resolve process obeys a very explicit flow:

- Enqueues the package to be resolved in the unit of work and waits
- When accepted calls #_createTempDir and waits
- When done, calls #_resolveSelf and waits
- When done, calls #_readRc and waits
- When done, calls #_readJson and waits
- When done, calls #_parseJson and waits
- When done, marks the package as resolved and informs the unit of work
- Afterwards, calls #_resolveDependencies and waits

#### Package#getResolveError() -> Error
Get the error occurred during the resolve process.
Returns null if no error occurred.

#### Package#getJson() -> Object
Get the package component.json.
Throws an error if the package is not yet resolved.

#### Package#getDependencies() -> Array
Get an array of packages that are direct dependencies of the package.
Throws an error if the package is not yet resolved.

#### Package#install(directory) -> Promise
Installs the package into the specified directory.
The base implementation simply renames the temporary directory to the install directory.
If the install directory already exists, it will be deleted unless it is some kind of repository.
If so, the promise should be rejected with a meaningful error.
Throws an error if the package is not yet resolved.

-----------

Protected functions

#### Package#_createTempDir() -> Promise
Creates a temporary dir.

#### Package#_readRc() -> Promise
Reads the local .bowerrc configuration.

#### Package#_readJson(rc) -> Promise
Reads the package component.json, possibly by using a dedicated `read-json` package that will be available in the bower organization. It will ensure everything is valid.

### Package#_parseJson(json) -> Promise
Parses the json:

- Checks if the packages name is different from the json one. If so and if the name was "guessed", the name of the package will be updated and a `name_change` event will be emited.
- Deletes files that are specified in the `ignore` property of the json from the temporary directory.
- For each dependency found in the json, a package should be created using the `createPackage` function.

#### Package#_resolveDependencies() -> Promise
Cycle through all the package dependences, calling #resolve() on them. The promise is fulfilled only when all dependencies are resolved.

--------

Abstract functions that must be implemented by concrete packages.

#### Package#_resolveSelf() -> Promise
Resolves self. This method should be implemented by the concrete packages. For instance, the UrlPackage would download the contents of a URL into the temporary directory.

### Type of packages

The following packages will extend from the Package.js and will obey its interface.

- `LocalPackage` extends `Package` (packages pointing to files of folders in the own system)
- `UrlPackage` extends `Package` (packages pointing to downloadable resources)
- `GitFsPackage` extends `Package` (git packages available in the own system)
- `GitRemotePackage` extends `Package` or `GitFsPackage` (remote git packages)
- `PublishedPackage` extends `Package` (? makes sense if bower supports a publish model, just like npm).
- `InstalledPackage` extends `Package` (locally installed packages located in the components folder)

These type of packages will be known and created (instantiated) by the `createPackage`.

This architecture will make it very easy for the community to create others package types, for instance, a MercurialLocalPackage and a MercurialRemotePackage.


### Unit of work -> EventEmitter

The unit of work is a central entity in which state will be stored during the unroll process of the dependency tree.

- Guarantees that a maximum of X packages are being resolved at every instant.
- Guarantees that packages with the same endpoint will not be resolved at the same time.
- Guarantees that packages with the exact same endpoint and range will not be resolved twice.
- Stores all the resolved/unresolved packages during the unroll of the dependency tree.
- When a package fails to resolve, it will make all the other enqueued ones to fail-fast.

------------

#### Events

- enqueue        - fired when a package is enqueued
- dequeue        - fired when a package is dequeued
- before_resolve - fired when a package is about to be resolved (fired after dequeue)
- resolve        - fired when a package resolved successfully
- unresolve      - fired when a package failed to resolve

With this events, it will be possible to track the current status of each package during the expansion of the dependency tree.

------------

#### Constructor

UnitOfWork(options)

Options:

- maxConcurrent - maximum number of concurrent packages being resolved (defaults to 5)
- failFast - true to fail-fast if an error occurred while resolving a package (defaults to true)

#### UnitOfWork#enqueue(package) -> Promise
Enqueues a package to be resolved.
The promise is fulfilled when the package is accepted to be resolved or is rejected if the unit of work is doomed to fail.
When fullfilled, a `done` function is passed that should be called when the resolve process of the package is finished:
Throws an error if the package is already queued or being resolved.

- If the package failed resolving, it should be called with an instance of `Error`. In that case, the package will be marked as unresolved and all the remaining enqueued packages will have the `enqueue` promise rejected, making the whole process to fail-fast.
- If the packages succeed resolving, it should be called with no arguments. In that case, the package will be marked as resolved

#### UnitOfWork#dequeue(package) -> Itself
Removes a previously enqueued package.

#### UnitOfWork#getResolved(name) -> Itself
Returns an array of resolved packages whose names are `name`.
When called without a name, returns an object with all the resolved packages.

#### UnitOfWork#getUnresolved(name) -> Itself
Returns an array of unresolved packages whose names are `name`.
When called without a name, returns an object with all the unresolved packages.


### Project / Manager -> EventEmitter

TODO


