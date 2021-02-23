# Contributing

The PbtA system is under the MIT license and is accepting merge requests and issue reports. Feel free to submit improvements to the system, and I'll review them and merge them if they're broadly useful for the community!

# Running the development version of the system

This repository is broken into `src/` and `dist/` directories. The `src/` directory has the source files I use during development (such as SCSS, Yaml config, and so forth), while the `dist/` directory includes only the files that Foundry will need to run the system.

The system is compiled using Gulp. You'll need node 12 or higher installed, and you can compile it with the following commands in the root of the repo:

```bash
npm install
npm run build
```

If you would like to have the gulp task actively watch for new changes, you can run `npm run gulp` instead to kick off a watch process that will immediately recompile changed files.

Once you have the system compiled, you can symlink or copy the dist dir into your install. For example, from the root of the repo:

```bash
ln -s ./pbta/dist $FoundryUserDataPath/systems/pbta
```

Replace the `$FoundryUserDataPath` variable with the actual path to your Foundry user data directory.

# A quick note on Patreon

This system has alpha and beta access tiers that are only available to Patrons of the system, but those changes will make their way out to the free beta tier a few weeks after each alpha/beta release.

However, I do not want to profit off of community code contributions. If you submit a merge request, I will test it locally for any breaking changes, and when accepted it will be merged directly to the public beta version and then be merged back into the Patreon alpha/beta branches.
