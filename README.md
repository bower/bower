# Bower rewrite

## Why?

Bower codebase is becoming unmanageable, especially at its core.
Main issues are:

- __No separation of concerns. The overall codebase has grown in a patch fashion, which has lead to a bloated and tight coupled solution.__
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
- Installation/update speedup.
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


### Architecture components details


#### Manager

TODO


#### PackageRepository

TODO


#### ResolverFactory

Simple function that takes a *named endpoint*/endpoint with options and creates an instance of a `Resolver` that obeys the base `Resolver` interface.

```js
function createResolver(endpoint, options) -> Promise
```

This function could perform transformations/normalisations to the tuple endpoint.
For instance, if `endpoint` is a shorthand it would expand it.
The function is actually async to allow query the bower registry to know the real endpoint.


#### ResolveCache

TODO


#### Resolver

The `Resolver` class extends `EventEmitter`.
Think of it as an abstract class that implements the resolver interface as well as serving as a base for other resolver types.

##### Events

- `name_change`: fired when the name of the package has changed
- `action`: fired to inform the current action being performed by the resolver
- `warn`: fired to inform a warning, e.g.: deprecation

##### Constructor

Resolver(source, options)

Options:

- `name` - the name (if none is passed, one will be guessed from the endpoint)
- `target` - the target (defaults to *)
- `config` - the config to use (defaults to the global config)

------------

Public functions

##### Resolver#getName() -> String
Returns the name.

##### Resolver#getSource() -> String
Returns the source.

##### Resolver#getTarget() -> String
Returns the target.

##### Resolver#getTempDir() -> String
Returns the temporary directory that the resolver can use to resolve itself.

##### Resolver#hasNew(oldVersion, oldResolution) -> Promise
Checks if there is a new version. Takes the old version and resolution to be used when comparing.   
Resolves to a boolean when done.

##### Resolver#resolve() -> Promise
Resolves the resolver.
The resolve process obeys a very explicit flow:

- calls #_createTempDir and waits
- When done, calls #_resolveSelf and waits
- When done, calls #_readJson and waits
- When done, calls #_parseJson and waits
- When done, resolves the promise with the resolution.

##### Resolver#getJson() -> Object
Get the `bower.json` of the resolved package.
Throws an error if the resolver is not yet resolved.

-----------

Protected functions

##### Resolver#_createTempDir() -> Promise
Creates a temporary dir.

##### Resolver#_readJson() -> Promise
Reads `bower.json`, possibly by using a dedicated `read-json` package that will be available in the Bower organization. It will ensure everything is valid.

##### Resolver#_parseJson(json) -> Promise
Parses the json:

- Checks if the resolver name is different from the json one. If so and if the name was "guessed", the name of the package will be updated and a `name_change` event will be emitted.
- Deletes files that are specified in the `ignore` property of the json from the temporary directory.

--------

Abstract functions that must be implemented by concrete resolvers.

##### Resolver#_resolveSelf() -> Promise
Resolves self. This method should be implemented by the concrete resolvers. For instance, the UrlResolver would download the contents of a URL into the temporary directory.

#### Types of Resolvers

The following resolvers will extend from `Resolver.js` and will obey its interface.

- `LocalResolver`     extends `Resolver` (dependencies pointing to files of folders in the own system)
- `UrlResolver`       extends `Resolver` (dependencies pointing to downloadable resources)
- `GitFsResolver`     extends `Resolver` (git dependencies available in the local file system)
- `GitRemoteResolver` extends `Resolver` or `GitFsResolver` (remote git dependencies)
- `PublishedResolver` extends `Resolver` (? makes sense if bower supports a publish model, just like `npm`).

These type of resolvers will be known and created (instantiated) by the `ResolverFactory`.

This architecture will make it very easy for the community to create others package types, for instance, a `MercurialLocalPackage`, `MercurialRemotePackage`, `SvnResolver`, etc.


#### Unit of work

TODO

