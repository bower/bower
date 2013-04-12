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

- Polymorphism can be used to make different kind of packages share a common API. Different kind of package resolvers will be implemented separately but will share common functionality. This will be further explained bellow.
- Promises could solve the nesting problem found in the codebase.
- **TODO: COMPLETE HERE**

## Implementation details

### Overall strategy

For the sake of simplicity, keep the following terms in mind:

- **UoW:** Unit of Work
- **Canonical endpoint:** The form in which a dependency endpoint is declared in the `bower.json` file.
- **Dep tuple (dependency tuple):** A data structure composed of an endpoint string (url, git repo, etc) and a *semver* compatible version.
- **Dep tuple range**: Same as *dep tuple*, but version can contain a range. Used mainly to specify a set of compatible versions.

Bower is composed of the following components:

- `CLI`: Command line interface for Bower.
- `.bowerrc`: Allows for customisations of Bower behaviour at the project/user level.
- `bower.json`: Main purpose is to declare the component dependencies and other component related information.
- `Manager`: Main coordinator, responsible for:
    - Deciding which version of the dependencies should be resolved while keeping every dependant compatible, and queueing those dependencies in the `UoW`.
    - Tracking which dependencies have been resolved, and which ones failed to resolve.
    - Caching resolved dependencies into `ResolveCache`.
    - Requesting `Uow` to fail-fast, in case it realises there is no resolution for the current dependency tree.
- `ResolveCache`: Keeps a cache of previously resolved *dep tuples*. Lookup can be done using a *dep tuple range*.
- `UnitOfWork`: Work coordinator, responsible for:
    - Keeping track of which *dep tuples* are being resolved.
    - Limiting amount of parallel resolutions
    - **QUESTION:** I see that *dep tuples* with same endpoint and different versions are not supposed to be processed in parallel. Not sure why, I don't see any problem with it. I even see a potential optimisation, in which the `Manager` realises that something that is being resolved will never be compatible, and aborts that specific resolution, and then queues another version (not a must for an initial version, but something to keep in mind).
- `ResolverFactory`: Parses a *dep tuple* and returns a `Resolver` capable of resolving the endpoint type.
- `Resolver`: Base resolver, which can be extended by concrete resolvers, like `UrlResolver`, `GitRemoteResolver`, etc.

Here's an overview of the resolution process (pseudo-algorithm):

1. `Manager` is requested to install a set of *dep tuple ranges* (may have come from `bower.json`, through the CLI, or even asked to install programatically).
2. **START OF RESOLUTION CYCLE**
3. `Manager` checks if `UoW` is currently resolving any of the *dep tuple ranges* and, if it is, no need to re-enqueue.
4. `Manager` queries `ResolveCache` for any cached resolution for the unresolved *dep tuple ranges*.
5. If there is no cache miss, use cached results and **RESOLUTION CYCLE IS DONE**.
6. Else, queue *dep tuple ranges* that are missing in cache into `UoW`.
7. While `UoW` has queued dependencies and parallel limit has not been reached, request `ResolverFactory` to fabricate a `Resolver` suited for each of the queued dependencies, and start their resolution (if limit has been reached, wait before starting resolution).
8. Every time a `Resolver` is done, the `UoW` notifies the `Manager`.
9. `Manager` caches the result in `ResolveCache`.
10. `Manager` asks the resolved `Resolver` if it has any dependency. Go to **START OF RESOLUTION CYCLE**, and continue process with the unresolved dependencies of the resolved `Resolver`.

### Project / Manager -> EventEmitter

TODO

### Resolve Cache

TODO

### Resolve Factory

Simple function that takes a *dep tuple range* with options and creates an instance of a `Resolver` that obeys the base `Resolver` interface.

```js
function createResolver(depTuple, options) -> Promise
```

This function could perform transformations/normalizations to the tuple endpoint.
For instance, if `endpoint` is a shorthand it would expand it.
The function is actually async to allow query the bower registry to know the real endpoint.

### Resolver -> EventEmitter

The `Resolver.js` class extends EventEmitter.
Think of it as an abstract class that implements the resolver interface as well as serving as a base for other resolver types.

#### Events

- `name_change`: fired when the name of the package has changed
- `action`: fired to inform the current action being performed by the resolver
- `warn`: fired to inform a warning, e.g.: deprecation
- `error`: fired when something went wrong
- `end`: fired when the resolution is complete

------------

#### Constructor

Resolver(depTuple, options)

Options:

- `name` - the package name (if none is passed, one will be guessed from the endpoint)
- `config` - the config to use (defaults to the global config)

------------

Public functions

#### Resolver#getName() -> String
Returns the package name.

#### Resolver#getEndpoint() -> String
Returns the package endpoint.

#### Resolver#getRange() -> String
Returns the semver range it should resolve to.

#### Resolver#getTempDir() -> String
Returns the temporary directory that the package is using to resolve itself.

#### Resolver#resolve()
Resolves the package.
The resolve process obeys a very explicit flow:

- calls #_createTempDir and waits
- When done, calls #_resolveSelf and waits
- When done, calls #_readJson and waits
- When done, calls #_parseJson and waits
- When done, marks the package as resolved and emits the `end` event.

#### Resolver#getResolveError() -> Error
Get the error occurred during the resolve process.
Returns null if no error occurred.

#### Resolver#getJson() -> Object
Get the package JSON.
Throws an error if the package is not yet resolved.

#### Resolver#getDependencies() -> Array
Get an array of packages that are direct dependencies of the package.
Throws an error if the package is not yet resolved.

#### Resolver#install(directory) -> Promise
Installs the package into the specified directory.
The base implementation simply renames the temporary directory to the install directory.
If the install directory already exists, it will be deleted unless it is some kind of repository.
If so, the promise should be rejected with a meaningful error.
Throws an error if the package is not yet resolved.

-----------

Protected functions

#### Resolver#_createTempDir() -> Promise
Creates a temporary dir.

### Resolver#_readJson() -> Promise
Reads `bower.json`, possibly by using a dedicated `read-json` package that will be available in the Bower organization. It will ensure everything is valid.

### Resolver#_parseJson(json) -> Promise
Parses the json:

- Checks if the packages name is different from the json one. If so and if the name was "guessed", the name of the package will be updated and a `name_change` event will be emited.
- Deletes files that are specified in the `ignore` property of the json from the temporary directory.

--------

Abstract functions that must be implemented by concrete resolvers.

#### Resolver#_resolveSelf() -> Promise
Resolves self. This method should be implemented by the concrete resolvers. For instance, the UrlPackage would download the contents of a URL into the temporary directory.

### Types of Resolvers

The following resolvers will extend from `Resolver.js` and will obey its interface.

- `LocalResolver`     extends `Resolver` (dependencies pointing to files of folders in the own system)
- `UrlResolver`       extends `Resolver` (dependencies pointing to downloadable resources)
- `GitFsResolver`     extends `Resolver` (git dependencies available in the local file system)
- `GitRemoteResolver` extends `Resolver` or `GitFsResolver` (remote git dependencies)
- `PublishedResolver` extends `Resolver` (? makes sense if bower supports a publish model, just like npm).

These type of resolvers will be known and created (instantiated) by the `ResolverFactory`.

This architecture will make it very easy for the community to create others package types, for instance, a `MercurialLocalPackage`, `MercurialRemotePackage`, `SvnResolver`, etc.


### Unit of work -> EventEmitter

------------

#### Events

- `enqueue`: fired when a package is enqueued
- `dequeue`: fired when a package is dequeued
- `pre_resolve`: fired when a package is about to be resolved (fired after dequeue)
- `post_resolve`: fired when a package resolved successfully
- `fail`: fired when a package failed to resolve

With these events, it will be possible to track the current status of each package during the expansion of the dependency tree.

------------

#### Constructor

UnitOfWork(options)

Options:

- `maxConcurrent`: maximum number of concurrent resolvers running (defaults to 5)
- `failFast`: true to fail-fast if an error occurred while resolving a package (defaults to true)

#### UnitOfWork#enqueue(depTuple) -> Promise
**WON'T TOUCH FROM HERE DOWN. SINCE A LOT HAS BEEN CHANGED, I WONDER IF THE PROMISES ARE REALLY NECESSARY FOR WHAT WE'RE TRYING TO ACCOMPLISH HERE. LET'S DISCUSS THIS TOMORROW**

Enqueues a resolver to be ran.
The promise is fulfilled when the package is accepted to be resolved or is rejected if the unit of work is doomed to fail.
When fullfilled, a `done` function is passed that should be called when the resolve process of the package is finished:
Throws an error if the package is already queued or being resolved.

- If the package failed resolving, it should be called with an instance of `Error`. In that case, the package will be marked as failed and all the remaining enqueued packages will have the `enqueue` promise rejected, making the whole process to fail-fast.
- If the packages succeed resolving, it should be called with no arguments. In that case, the package will be marked as resolved

#### UnitOfWork#dequeue(package) -> Itself
Removes a previously enqueued package.

#### UnitOfWork#getResolved(name) -> Itself
Returns an array of resolved packages whose names are `name`.
When called without a name, returns an object with all the resolved packages.

#### UnitOfWork#getFailed(name) -> Itself
Returns an array of packages that failed to resulve whose names are `name`.
When called without a name, returns an object with all the failed packages.

