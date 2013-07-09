- Registry
    - Register model
        - Allow endpoints other than git?
        - Allow easy unregister
        - Possible ways to get rid of shim repos
          - https://github.com/twitter/bower/issues/172#issuecomment-13017880
          - https://github.com/twitter/bower/issues/198
          - But then.. how would versions be handled here?? different versions might have changed the deps
    - Publish model
- Commands
    - Bower script x
         - post-install (only useful for moving files around)
         - pre-publish
         - etc
    - bower test
    - bower install & update
        - Option to install deps in a tree structure like npm? see: https://github.com/twitter/bower/issues/157
        - Allow overrides of the registry for easier fork integration? this need to be discussed as part of the spec, see: https://github.com/twitter/bower/issues/342

- Bower could setup a git hook on folders that are github repos to make validation of the json (if it conforms with the spec)
- Ddd perf tests
  - http://trace.gl
- Discuss ability to specify folders inside bower_components.. e.g. components/fonts/
- Discuss namespaces in the registry
- Implement shrinkwrap?

Non BC changes:
- Removed json property from the config
