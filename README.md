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

## Advantages

- Installation/update speedup.
- Named endpoints.
- Offline installation of packages, thanks to the cache.
- Clear architecture and separation of concerns.

## Implementation details

### Term dictionary

- **Canonical package:** A folder containing all the files that belong to a package. May include a `bower.json` file inside. (typically what gets installed)
- **Source:** URL, git endpoint, etc.
- **Target:** `semver` range, commit hash, branch (indicates a version).
- **Endpoint:** source#target
- **Named endpoint:** name@endpoint#target
- **UoW:** Unit of Work
- **Components folder:** The folder in which components are installed (`bower_components` by default).

### Overall strategy

![Really nicely drawn architecture diagram](http://f.cl.ly/items/44271M0R1O012H2m4234/resolve_diagram.png "Don't over think it! We already did! :P")

Bower is composed of the following components:

- `CLI`: Command line interface for Bower.
- `.bowerrc`: Allows for customisations of Bower behaviour at the project/user level.
- `bower.json`: Main purpose is to declare the component dependencies and other component related information.
- `Manager`: Main coordinator, responsible for:
    - Checking which packages are already installed in the current `bower folder`.
    - Deciding which version of the dependencies should be fetched from the `PackageRepository`, while keeping every dependant compatible (note that the `Manager` is `server` aware).
    - Tracking which dependencies have been fetched, which ones failed to fetch, and which ones are being fetched.
    - Requesting the `PackageRepository` to fail-fast, in case it realises there is no resolution for the current dependency tree.
- `PackageRepository`: Abstraction to the underlying complexity of heterogeneous source types. Responsible for:
  - Storing new entries in `ResolveCache`.
  - Queueing resolvers into the `UoW`, if no suitable entry is found in the `ResolveCache`.
- `ResolveCache`: Keeps a cache of previously resolved endpoints. Lookup can be done using an endpoint.
- `UnitOfWork`: Work coordinator, responsible for:
    - Keeping track of which resolvers are being resolved.
    - Limiting amount of parallel resolutions.
- `ResolverFactory`: Parses an endpoint and returns a `Resolver` capable of resolving the source type.
- `Resolver`: Base resolver, which can be extended by concrete resolvers, like `UrlResolver`, `GitRemoteResolver`, etc.


Here's an overview of the resolution process:

1. **INSTALL/UPDATE** - A set of named endpoints and/or endpoints is requested to be installed/updated, and these are passed to the `Manager`.

2. **ANALIZE COMPONENTS FOLDER** -  `Manager` starts by reading the *components folder* and understanding which packages are already installed.

3. **ENQUEUE ENDPOINTS** - For each endpoint that should be fetched, the `Manager` enqueues the *named endpoints*/endpoints in the `PackageRepository`. Some considerations:
    - If a package should be fetched or not depends on the following conditions:
        - What operation is being done (install/update).
        - If package is already installed.
        - If `Manager` has already enqueued that *named endpoint*/endpoint in the current runtime (regardless of the fetch being currently in progress, already complete, or failed).
        - Additional flags (force, etc).

4. **FABRICATE RESOLVERS** - For each of the endpoints, the `PackageRepository` requests the `ResolverFactory` for suitable resolvers, capable of handling the source type. Some considerations:
    - The factory method takes the source string as its main argument, and is also provided with target, and package name if possible (all this information is extracted from the *named endpoint*/endpoint).
    - This method is asynchronous, in order to allow for I/O operations to happen, without blocking the whole process (e.g., querying registry, etc).
    - There is a runtime internal cache of sources that have already been analysed, and what type of `Resolver` resulted from that analysis. This speeds up the decision process, particularly for aliases (registered packages), and published packages, which would required HTTP requests.

5. **LOOKUP CACHE** - `PackageRepository` looks up the `ResolveCache` using the endpoint, for a cached *canonical package* that complies to the endpoint target. Some considerations:
    - The lookup is performed using an endpoint that is fetched from the `Resolver`. This allows the resolver to guarantee that the endpoint has been normalised (twitter/bootstrap -> git://github.com/twitter/bootstrap.git, etc).
    - The `ResolveCache` is `semver` aware. What this means, is that if you try to lookup `~1.2.1`, and the cache has a entries for versions `1.2.3` and `1.2.4`, it will give a hit with `1.2.4`.

6. **CACHE HIT VALIDATION** - At this stage, and only for the cache hits, the `PackageRepository` will question the `Resolver` if there is any version higher than the one fetched from cache that also complies with the endpoint target. Some considerations:
    - How the `Resolver` checks this, depends on the `Resolver` type. (e.g. `GitRemoteResolver` would fetch the git refs, and check if there is a higher version that complies with the target). 
    - This check should be as quick as possible. If the process of checking a new version is too slow, it's preferable to just assume there is a new version.
    - If there is no way to check if there is a higher version, assume that there is.
    - If the `Resolver` indicates that the cached version is outdated, then it is treated as a cache miss, unless there is a flag that forces to use cached entries (like an `offline` flag).

7. **RESOLVE CACHE MISSES** - Any cache miss needs to be resolved, so the `PackageRepository` requests each of the remaining resolvers to resolve, and waits.

8. **CACHE RESOLVED PACKAGES** - As the resolvers complete the resolution, the `PackageRepository` stores the canonic packages in the `ResolveCache`, along with the source, version, and any additional information that the `Resolver` provides (this allows for concrete to store additional details about the fetched package, like HTTP expiration headers, in the case of the `UrlPackage`).

9. **RETURN PACKAGE TO MANAGER** - The `PackageRepository` returns the canonical package to the `Manager`.

10. **EVALUATE RESOLVED PACKAGE DEPENDENCIES** - The `Manager` checks if the returned canonical packages have a `bower.json` file describing additional dependencies and, if so, continue in point #3. If there are no more unresolved dependencies, finish up the installation procedure.


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

