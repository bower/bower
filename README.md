# Bower rewrite [![Build Status](https://secure.travis-ci.org/bower/bower.png?branch=rewrite)](http://travis-ci.org/bower/bower)

## Why?

Bower code base is becoming unmanageable, especially at its core.
Main issues are:

- __No separation of concerns. The overall code base has grown in a patch fashion, which has lead to a bloated and tight coupled solution.__
- __Monolithic Package.js that handles all package types (both local and remote `Git`, URL, local files, etc).__
- __Package.js has a big nesting level of callbacks, causing confusion and making the code hard to read.__
- Some commands, such as install and update, have incorrect behaviour ([#200](https://github.com/bower/bower/issues/200), [#256](https://github.com/bower/bower/issues/256))
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
- Improve tests coverage
- Integrate with update-notifier and yeomen insight.


## Implementation details

### Term dictionary

- **Canonical package:** A folder containing all the files that belong to a package. May include a `bower.json` file inside. (typically what gets installed)
- **Source:** URL, git endpoint, etc.
- **Target:** `semver` range, commit hash, branch (indicates a version).
- **Endpoint:** name=source#target
- **Decomposed endpoint:** An object containing the `name`, `source` and `target` keys.
- **Components folder:** The folder in which components are installed (`bower_components` by default).
- **Package meta:** A data structure similar to the one found in `bower.json`, which might also contain additional information. This is stored in a `.bower.json` file, inside a canonical package.

### Overall strategy

![Really nicely drawn architecture diagram](http://f.cl.ly/items/01370R0d3u2K3B381E2J/resolve_diagram.jpg "Don't over think it! We already did! :P")

Bower is composed of the following components:

- `CLI`: Command line interface for Bower.
- `.bowerrc`: Allows for customisations of Bower behaviour at the project/user level.
- `bower.json`: Main purpose is to declare the component dependencies and other component related information.
- `Manager`: Main coordinator, responsible for:
    - Deciding which version of the dependencies should be fetched from the `PackageRepository`, while keeping every dependant compatible (note that the `Manager` is `semver` aware).
    - Tracking which dependencies have been fetched, which ones failed to fetch, and which ones are being fetched.
    - Expanding the dependency tree, analysing the dependencies of each fetched package.
- `PackageRepository`: Abstraction to the underlying complexity of heterogeneous source types. Responsible for:
  - Collecting concrete `Resolver`s for each endpoint
  - Querying the `Resolve` cache for already resolved packages of the same target
  - Decide if the cached package can be used.
  - Storing new entries in `ResolveCache`.
- `ResolveCache`: Keeps a cache of previously resolved endpoints. Lookup can be done using an endpoint.
- `ResolverFactory`: Parses an endpoint and returns a `Resolver` capable of resolving the source type.
- `Resolver`: Base resolver, which can be extended by concrete resolvers, like `UrlResolver`, `GitRemoteResolver`, etc.

You can find additional details about each of these components below, in [Architecture components details](#architecture-components-details).


#### Resolve process

Here's an overview of the dependency resolve process:

1. **INSTALL/UPDATE** - A set of endpoints is requested to be installed/updated, and these are passed to the `Manager`.

2. **ANALIZE COMPONENTS FOLDER** - `Manager` starts by reading the `components folder` and understanding which packages are already installed.

3. **ENQUEUE ENDPOINTS** - For each endpoint that should be fetched, the `Manager` enqueues the `decomposed endpoints` in the `PackageRepository`. Some considerations:
    - If a package should be fetched or not depends on the following conditions:
        - What operation is being done (install/update).
        - If package is already installed.
        - If `Manager` has already enqueued that endpoint in the current runtime (regardless of the fetch being currently in progress, already complete, or failed).
        - Additional flags (force, etc).

4. **FABRICATE RESOLVERS** - For each of the endpoints, the `PackageRepository` requests the `ResolverFactory` for suitable resolvers, capable of handling the source type. Some considerations:
    - This method is asynchronous, in order to allow for I/O operations to happen, without blocking the whole process (e.g., querying registry, etc).
    - There is a runtime internal cache of sources that have already been analysed, and what type of `Resolver` resulted from that analysis. This speeds up the decision process, particularly for aliases (registered packages), and published packages, which would required HTTP requests.

5. **LOOKUP CACHE** - `PackageRepository` looks up the `ResolveCache` using the endpoint, for a cached `canonical package` that complies to the endpoint target. Some considerations:
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

Main resolve coordinator.


##### Constructor

`Manager(config)`

If `config` is not passed, the default one will be used.

##### Public methods

`Manager#setProduction(production)`: Manager

Enable/disable production (read of devDependencies).

`Manager#configure(targets, resolved, installed)`: Manager

Configures the manager with `targets` and `installed`:

- `targets`: array of decomposed endpoints that need to be installed
- `resolved`: object of resolved packages (keys are names and values the reconstructed decomposed endpoints)
- `installed`: object of currently installed packages (keys are names and values the package metas)

If the Manager is already working, the promise is immediately rejected.

`Manager#resolve()`: Promise

Starts the resolve process, returning a promise of an object which keys are package names and
values the associated resolve info (decomposed endpoints plus package meta and other info).

If the Manager is already working, the promise is immediately rejected.

`Manager#install()`: Promise

Installs packages that result from the dissection of the resolve process.
The promise is resolved with an object where keys are package names and values the package meta's.

If the Manager is already working, the promise is immediately rejected.

TODO

`Manager#areCompatible(source, subject)`: Boolean

TODO


#### PackageRepository

Abstraction to the underlying complexity of heterogeneous source types


##### Constructor

`PackageRepository(config)`

If `config` is not passed, the default one will be used.

##### Public methods

`PackageRepository#fetch(decEndpoint)`: Promise

Enqueues an decomposed endpoint to be fetched, and returns a promise of a `canonical package`.

`PackageRepository#empty(name)`: Promise

Empties any resolved cache for package `name` or all the resolved cache if no `name` is passed.


#### ResolverFactory

Simple function that takes a `decomposed endpoint` and creates an instance of a concrete `Resolver` that obeys the base `Resolver` interface.

```js
function createResolver(decEndpoint, registryClient, config) -> Promise
```

The function is async to allow querying the Bower registry, etc.   
The `registryClient` is an instance of [`RegistryClient`](https://github.com/bower/registry-client) to be used. If null, the registry won't be queried.   
If `config` is not passed, the default config will be used.


#### ResolveCache

The cache, stored in disk, of resolved packages (canonical packages).

##### Constructor

`ResolveCache(config)`

------------

##### Public functions

`ResolveCache#retrieve(source, target)`: Promise

Retrieves `canonical package` for a given `source` and `target` (optional, defaults to `*`).   
The promise is resolved with both the `canonical package` and `package meta`.

`ResolveCache#store(canonicalPackage, pkgMeta)`: Promise

Stores `canonicalPackage` into the cache.   
The `pkgMeta` is optional and will be read if not passed.

`ResolveCache#eliminate(source, version)`: Promise

Eliminates entry with given `source` and `version` from the cache.   
Note that `version` can be empty because some `canonical package`s do not have a version associated.
In that case, only the unversioned entry will be removed.

`ResolveCache#empty(source)`: Promise

Eliminates `canonical package`s that match the `source` or everything if `source` is not passed.


#### Resolver

Think of `Resolver` as an abstract class that implements the resolver interface as well as serving as a base for other resolver types.

Resolvers are responsible for the following:

- Based on an endpoint, fetch the contents of the package into a temporary folder (step is implemented by the `_resolveSelf()` method).
- After the package is fetched, the `bower.json`/`component.json` (deprecated) file is read, validated and normalised (fill in properties) into a `package meta` object. If the file does not exist, a base one is inferred. Note that this should be done using a node module that is common for both the Bower client and the server.
- Update any relevant information based on the `package meta` (e.g. this step may emit a `name_change`).
- Applying the `ignore` constraint based on the `package meta`. Files are effectively removed in this step.
- Attach any additional meta data to the `package meta`. (e.g. the `UrlResolver` might store some `HTTP` response headers, to aid the `hasNew()` decision later on).
- Storing the `package meta` into a `.bower.json` hidden file.


##### Constructor

`Resolver(decEndpoint, config)`

------------

##### Public functions

`Resolver#getSource()`: String

Returns the source.

`Resolver#getName()`: String

Returns the name.

`Resolver#getTarget()`: String

Returns the target.

`Resolver#getTempDir()`: String

Returns the local temporary folder into which the package is being fetched. The files will remain here until the folder is moved when installing.

`Resolver#hasNew(canonicalPkg, pkgMeta)`: Promise

Checks if there is a version more recent than the provided `canonicalPkg` (folder) that complies with the resolver target.
The hasNew process is as follows:

- Reads the `package meta` from the `canonical package` if not supplied
- If there's an error while reading the `package meta`, it resolves to `true` because the package might be broken
- Otherwise, calls `_hasNew()` with the `canonical package` and `package meta` as arguments

If the resolver is already working, either resolving or checking for a newer version, the promise is immediately
rejected.

`Resolver#resolve()`: Promise

Resolves the resolver, and returns a promise of a canonical package.
The resolve process is as follows:

- Calls `_createTempDir()` and waits.
- When done, calls `_resolve()` and waits.
- When done, calls `_readJson()` and waits (validation and normalisation also happens here).
- When done, calls both functions below, and waits:
    - `_applyPkgMeta(meta)`
    - `_savePkgMeta(meta)`
- When done, resolves the promise with the *temp dir*, which is now a canonical package.

If the resolver is already working, either resolving or checking for a newer version, the promise is immediately
rejected.

`Resolver#getPkgMeta()`: Object

Get the `package meta`. Essentially, it's what you'll find in `.bower.json`.
Throws an error if the resolver is not yet resolved.

-----------

##### Public static functions

`Resolver#clearRuntimeCache()`

Clears the resolver runtime cache, that is, data stored statically.
Resolvers may cache data based on the sources to speed up calls to `hasNew` and `resolve` for the
same source.

-----------

##### Protected functions

`Resolver#_hasNew(pkgMeta, canonicalPkg)`: Promise

The process of checking for a newer version. This function should be as fast as possible.  
Concrete resolvers are encouraged to rewrite this function since the default implementation resolves to `true`.

`Resolver#_createTempDir()`: Promise

Creates a temporary dir.

`Resolver#_readJson()`: Promise

Reads `bower.json`/`component.json`, possibly by using a dedicated `read-json` node module that will be available in the Bower organisation.

This method also generates the `package meta` based on the `json`, filling in any missing information, inferring when possible.

`Resolver#_applyPkgMeta(meta)`: Promise

Since the `package meta` might contain some information that has implications to the *canonical* state of the package, this is where these rules are enforced.

- Checks if the resolver name is different from the json one. If so and if the name was "guessed", the name of the package will be updated and a `name_change` event will be emitted.
- Deletes files that are specified in the `ignore` property of the json from the temporary directory.

`Resolver#_savePkgMeta(meta)`: Promise

Stores the `package meta` into a `.bower.json` file inside the root of the package.
Concrete resolvers may override this to add any additional information that might be relevant to be stored. A `UrlResolver` could, for example, store some `HTTP` headers, that would be useful when comparing versions, in the `hasNew()` method.

--------

##### Abstract functions that must be implemented by concrete resolvers.

`Resolver#_resolve()`: Promise

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