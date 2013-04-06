TODO list:

- config
   - Fix nodejs 0.10.x issue due to a bug in the `rc` package. I've already submited a [PR](https://github.com/dominictarr/config-chain/pull/11)
   - Allow `config.cwd` to be changed by an argument when using the CLI. Two ways of doing this:
      - Read a --cwd or similar and change the `config.cwd` to it
      - Allow any arbitrary `config.*` to be changed with --config.* arguments
- Gracefully remove all created tmp dirs
