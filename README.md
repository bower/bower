# Bower rewrite

## Why?

Bower code base is becoming unmanageable, especially at its core.
Main issues are:

- __No separation of concerns. The overall code base has grown in a patch fashion, which has lead to a bloated and tight coupled solution.__
- __Monolithic Package.js that handles all package types (both local and remote `Git`, URL, local files, etc).__
- __Package.js has a big nesting level of callbacks, causing confusion and making the code hard to read.__
- Some commands, such as install and update, have incorrect behaviour ([#200](https://github.com/twitter/bower/issues/200), [#256](https://github.com/twitter/bower/issues/256))
   - This is directly related with the current implementation of bower core: Package.js and Manager.js
- Programmatic usage needs improvement
  - Unable to spawn multiple commands in parallel in different folders
  - Some commands simply do not fire the `end` event
  - Others fire the `error` event many times
  - Some commands should fire more meaningful events (e.g.: install should fire each installed package)


## Main goals

- Ease the process of gathering more contributors.
- Clear architecture and separation of concerns.
- Installation/update speed-up.
- Named endpoints on the CLI install.
- Offline installation of packages, thanks to the cache.
- Ability to easily add package types (`SVN`, etc).
- Support for commit hashes and branches in targets for `Git` endpoints.
- Improved output after installation/update.
- Integrate with update-notifier and yeomen insight.


## Implementation details

### Term dictionary

- **Canonical package:** A folder containing all the files that belong to a package. May include a `bower.json` file inside. (typically what gets installed)
- **Source:** URL, git endpoint, etc.
- **Target:** `semver` range, commit hash, branch (indicates a version).
- **Endpoint:** source#target
- **Named endpoint:** name@endpoint#target
- **Components folder:** The folder in which components are installed (`bower_components` by default).
- **Package meta:** A data structure similar to the one found in `bower.json`, which might also contain additional information. This is usually stored in a `.bower.json` file, inside a canonical package.

### Overall strategy

![Really nicely drawn architecture diagram](http://f.cl.ly/items/2z0u3B1817341P0q0H3M/bower_diagram2.jpg "Don't over think it! We already did! :P")

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
  - Queueing resolvers into the `Worker`, if no suitable entry is found in the `ResolveCache`.
- `ResolveCache`: Keeps a cache of previously resolved endpoints. Lookup can be done using an endpoint.
- `Worker`: A service responsible for limiting amount of parallel executions of tasks of the same type.
- `ResolverFactory`: Parses an endpoint and returns a `Resolver` capable of resolving the source type.
- `Resolver`: Base resolver, which can be extended by concrete resolvers, like `UrlResolver`, `GitRemoteResolver`, etc.

You can find additional details about each of these components below, in [Architecture components details](#architecture-components-details).


#### Resolve process

Here's an overview of the dependency resolve process:

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
    - This step is ignored in case a flag like `offline` is passed.
    - How the `Resolver` checks this, depends on the `Resolver` type. (e.g. `GitRemoteResolver` would fetch the git refs with `git ls-remote --tags --heads`, and check if there is a higher version that complies with the target).
    - This check should be as quick as possible. If the process of checking a new version is too slow, it's preferable to just assume there is a new version.
    - If there is no way to check if there is a higher version, assume that there is.
    - If the `Resolver` indicates that the cached version is outdated, then it is treated as a cache miss.

7. **RESOLVE CACHE MISSES** - Any cache miss needs to be resolved, so the `PackageRepository` requests each of the remaining resolvers to resolve, and waits.

8. **CACHE RESOLVED PACKAGES** - As the resolvers complete the resolution, the `PackageRepository` stores the canonic packages in the `ResolveCache`, along with the source, version, and any additional information that the `Resolver` provides. This allows resolvers to store additional details about the fetched package to be used for future *cache hit validations* (e.g. store HTTP expiration headers in the case of the `UrlPackage`).

9. **RETURN PACKAGE TO MANAGER** - The `PackageRepository` returns the canonical package to the `Manager`.

10. **EVALUATE RESOLVED PACKAGE DEPENDENCIES** - The `Manager` checks if the returned canonical packages have a `bower.json` file describing additional dependencies and, if so, continue in point #3. If there are no more unresolved dependencies, finish up the installation procedure.

-----

### Architecture components details


#### Manager

TODO


#### PackageRepository

##### Constructor

`PackageRepository()`

##### Public methods

`PackageRepository#get(endpoint)`: Promise

Enqueues an endpoint to be fetched, and returns a promise of a *canonical package*.

`PackageRepository#abort()`: Promise

Aborts any queued package lookup as soon as possible, and returns a promise that everything has been aborted.

##### Protected methods

*CONTINUE HERE*


#### ResolverFactory

Simple function that takes a *named endpoint*/endpoint with options and creates an instance of a concrete `Resolver` that obeys the base `Resolver` interface.

```js
function createResolver(endpoint, options) -> Promise
```

This function will perform transformations/normalisations to the endpoint, like expanding shorthand endpoints.
The function is async to allow querying the Bower registry, etc.


#### ResolveCache

TODO


#### Resolver

The `Resolver` class extends `EventEmitter`.
Think of it as an abstract class that implements the resolver interface as well as serving as a base for other resolver types.

Resolvers are responsible for the following:

- Based on an endpoint, fetch the contents of the package into a temporary folder (step is implemented by the `_resolveSelf()` method).
- After the package is fetched, the `bower.json`/`component.json` (deprecated) file is read, validated and normalised (fill in properties) into a `package meta` object. If the file does not exist, a base one is inferred. Note that this should be done using a node module that is common for both the Bower client and the server.
- Update any relevant information based on the `package meta` (e.g. this step may emit a `name_change`).
- Attach any additional meta data to the `package meta`. (e.g. the `UrlResolver` might store some `HTTP` response headers, to aid the `hasNew()` decision later on).
- Applying the `ignore` constraint based on the `package meta`. Files are effectively removed in this step.
- Storing the `package meta` into a `.bower.json` hidden file.


##### Events

- `name_change`: fired when the name of the package has changed
- `action`: fired to inform the current action being performed by the resolver
- `warn`: fired to inform a warning, e.g.: deprecation

##### Constructor

`Resolver(source, options)`

Options:

- `name` - the name (if none is passed, one will be guessed from the source)
- `target` - the target (defaults to *)
- `config` - the config to use (defaults to the global config)

------------

##### Public functions

`Resolver#getName()`: String

Returns the name.

`Resolver#getSource()`: String

Returns the source.

`Resolver#getTarget()`: String

Returns the target.

`Resolver#getTempDir()`: String

Returns the local temporary folder into which the package is being fetched. The files will remain here until the folder is moved when installing.

`Resolver#hasNew(canonicalPackage)`: Promise

Checks if there is a version more recent than the provided `canonicalPackage` (folder) that complies with the resolver target.

`Resolver#resolve()`: Promise

Resolves the resolver, and returns a promise of a canonical package.
The resolve process is as follows:

- calls `_createTempDir()` and waits.
- When done, calls `_resolveSelf()` and waits.
- When done, calls `_readJson()` and waits (validation and normalisation also happens here).
- When done, calls `_decoratePkgMeta()`, giving the resolver the chance to attach additional information about the resolved package (`HTTP` headers, etc).
- When done, calls both, and waits:
    - `_applyPkgMeta(meta)`
    - `_savePkgMeta(meta)`
- When done, resolves the promise with the *temp dir*, which is now a canonical package.

`Resolver#getPackageMeta()`: Object

Get the `package meta`. Essentially, it's what you'll find in `.bower.json`.
Throws an error if the resolver is not yet resolved.

-----------

##### Protected functions

`Resolver#_createTempDir()`: Promise

Creates a temporary dir.

`Resolver#_readJson()`: Promise

Reads `bower.json`/`component.json`, possibly by using a dedicated `read-json` node module that will be available in the Bower organisation.

This method also generates the `package meta` based on the `json`, filling in any missing information, inferring when possible.

`Resolver#_decoratePkgMeta(meta)`: Promise

Decorates the `package meta` with any additional information that might be relevant to be stored. A `UrlResolver` could, for example, store some `HTTP` headers, that would be useful when comparing versions, in the `hasNew()` method.

`Resolver#_applyPkgMeta(meta)`: Promise

Since the `package meta` might contain some information that has implications to the *canonical* state of the package, this is where these rules are enforced.

- Checks if the resolver name is different from the json one. If so and if the name was "guessed", the name of the package will be updated and a `name_change` event will be emitted.
- Deletes files that are specified in the `ignore` property of the json from the temporary directory.

`Resolver#_savePkgMeta(meta)`: Promise

Stores the `package meta` into a `.bower.json` file inside the root of the package.

--------

##### Abstract functions that must be implemented by concrete resolvers.

`Resolver#_resolveSelf()`: Promise

The actual process of fetching the package files. This method must he implemented by concrete resolvers. For instance, the `UrlResolver` would download the contents of a URL into the temporary directory in this stage.

#### Resolver types

The following resolvers will extend from `Resolver.js` and obey its interface.

- `LocalResolver`     extends `Resolver` (dependencies pointing to files of folders in the own system)
- `UrlResolver`       extends `Resolver` (dependencies pointing to downloadable resources)
- `GitFsResolver`     extends `Resolver` (git dependencies available in the local file system)
- `GitRemoteResolver` extends `Resolver` or `GitFsResolver` (remote git dependencies)
- `PublishedResolver` extends `Resolver` (? makes sense if bower supports a publish model, just like `npm`).

The `ResolverFactory` knows these types, and is able to fabricate suitable resolvers based on the source type.

This architecture makes it very easy for the community to create others package types, for instance, a `MercurialFsResolver`, `MercurialResolver`, `SvnResolver`, etc.


#### Worker

A worker responsible for limiting execution of parallel tasks.
The number of parallel tasks may be limited and configured per type.
This component will be a service that can be accessed to perform tasks.

------------

#### Constructor

`Worker(defaultConcurrency, types)`

The `defaultConcurrency` is the default maximum concurrent functions being run.   
The `types` allows you to specify different concurrencies for different types.   
Use `-1` to specify no limits.

Example:

```js
var worker = new Worker(15, {
    'network_io': 10,
    'disk_io': 50
});
```

------------

#### Public methods.

`Worker#enqueue(func, [type])`: Promise

Enqueues a function to be ran. The function is expected to return a promise or a value.   
The returned promise is resolved when the function promise is also resolved.

The `type` argument is optional and can be a `string` or an array of `strings`.   
Use it to specify the type(s) associated with the function.
If multiple types are specified, the function will only ran when a free slot of every type is found.   
If no `type` is passed or is unknown, the `defaultConcurrency` is used.

`Worker#abort()`: Promise

Aborts all current work being done.
Returns a promise that is resolved when the current running functions finish to execute.   
Any function that was in the queue waiting to be ran is removed immediately.


