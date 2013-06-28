# Rewrite improvements and fixes

## General

- Clear architecture and separation of concerns

The new architecture will allow us to iterate much faster.   
It will also increase the number of contributors due to code readability.

For a more detailed overview of the architecture, please read the [rewrite](https://github.com/bower/bower/tree/rewrite) details.

- Much faster overall

Please see [this](https://www.youtube.com/watch?feature=player_embedded&v=o9Xo_WFAyqg#t=1451s) video for a
short demo.

- Every command has `JSON` output if the `--json` or `-j` flag is used

This makes very easy for external tools to parse bower output.

- Offline usage with `--offline` or `-o` for every command

Yes, every command has `offline` usage, even `install`, `update`, `search` and `info`.   
Well I'm lying, the `register` command is the only one that can't be offline.

- Improved programmatic usage
  - Allows parallel execution of commands (via `config`, with the ability to change cwd with `config.cwd`)
  - Allows passing specific config objects when running commands
  - Every command now emit events correctly (no longer emits repeated events and/or omits them)

- Responsive output for some commands

On large terminals, the output is more complete. Degrades gracefully for smaller ones.

![http://f.cl.ly/items/0Y012k331O0y2m2O0Q1J/Screen%20Shot%202013-06-28%20at%2010.07.31%20PM.png](http://f.cl.ly/items/0Y012k331O0y2m2O0Q1J/Screen%20Shot%202013-06-28%20at%2010.07.31%20PM.png)

![http://f.cl.ly/items/0t101M300t3W23211o3j/Screen%20Shot%202013-06-28%20at%2010.08.00%20PM.png](http://f.cl.ly/items/0t101M300t3W23211o3j/Screen%20Shot%202013-06-28%20at%2010.08.00%20PM.png)

- Added log levels

Allows to specify the desired log level, including/excluding logging information based on it

- Many other general fixes, please checkout the GitHub [issues](https://github.com/bower/bower/issues) tagged with `fixed-rewrite`


## install

- You can now target `tags`, `branches` and `commit hashes` when installing `git` endpoints

- Only installs missing packages. Previously installed all the packages everytime

- Prompts the user on conflict, with the option to persist choices to `bower.json`

![http://f.cl.ly/items/0118451z3P0B2Q1O0X1h/Screen%20Shot%202013-06-25%20at%209.23.55%20PM.png](http://f.cl.ly/items/0118451z3P0B2Q1O0X1h/Screen%20Shot%202013-06-25%20at%209.23.55%20PM.png)

Choices are persisted to the `resolutions` key in your `bower.json`.   
When a resolution is not longer needed, it will be automatically deleted.

- Installing a specific package always finds the most suitable version, prompting on conflict.

It previously installed the specified version despite other dependencies requiring other versions, leading to a broken project

- Allows named packages when installing.

This allows to map packages to different names. For instance, `bower install backbone=backbone-amd#~1.0.0` will treat `backbone-amd` as `backbone`.

- Shows a dependency tree, similar to `npm`, for each installed package

![http://f.cl.ly/items/2M3V2u02161i433m060f/Screen%20Shot%202013-06-15%20at%2011.30.49%20PM.png](http://f.cl.ly/items/2M3V2u02161i433m060f/Screen%20Shot%202013-06-15%20at%2011.30.49%20PM.png)


- Bower now expands `tar` and `tar.gz` URLs and local files endpoints


## update

- Prompts the user on conflict, with the option to persist choices to `bower.json`

- Shows a dependency tree, similar to `npm`, for each updated package

- Updating a specific package always finds the most suitable version, prompting on conflict.

It previously installed the specified version despite other dependencies requiring other versions, leading to a broken project


- Bower now expands `tar` and `tar.gz` URLs and local files endpoints


## info

- You can now request info of a particular package version, similar to `npm`

![http://f.cl.ly/items/0i2M3C003v0w3v3s2C1U/Screen%20Shot%202013-06-23%20at%201.22.36%20AM.png](http://f.cl.ly/items/0i2M3C003v0w3v3s2C1U/Screen%20Shot%202013-06-23%20at%201.22.36%20AM.png)


## register

- Validates package before registering, guaranteeing that invalid packages are no longer registered


![http://f.cl.ly/items/0U1L042D1Y300L1m3c0w/Screen%20Shot%202013-06-28%20at%2010.03.07%20PM.png](http://f.cl.ly/items/0U1L042D1Y300L1m3c0w/Screen%20Shot%202013-06-28%20at%2010.03.07%20PM.png)

## cache list (new)

- Shows a list of the cached packages

## cache clean

- Changed from `cache-clean` to `cache clean`

## list

- Shows a label on each incompatible package

- Shows a label on each extraneous package (packages that are not saved in `bower.json`)

- Shows a label on each missing package

- Shows a label on each linked package

![http://f.cl.ly/items/2j1K2S3e3H3T0b0k2z0X/Screen%20Shot%202013-06-28%20at%2010.00.45%20PM.png](http://f.cl.ly/items/2j1K2S3e3H3T0b0k2z0X/Screen%20Shot%202013-06-28%20at%2010.00.45%20PM.png)

# To be done

## Commands

- config set
- config get
- config del
- config list
- config edit
- prune
- init

## Tests

- Add tests for every class except for the resolvers which are already done
- Add commands tests
- Add high level tests
- Added tests for `registry-client` module
- Add tests for the `bower-json` module

## Other

- Complete the `bower-json` module implementation
- Start the implementation of the `config` module in order to implement the config commands
- Add commands completion
- Add command aliases
- Clear invalid links when running `bower cache clean`
- Check for new package versions when running `bower list`
- Add `config` settings for the cache, such as max size, max entries, etc
- Add ability to clear runtime cache (for long-lived processes)
- Resolve issues tagged with `rewrite`

