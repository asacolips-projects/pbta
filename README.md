Compatible with FoundryVTT 0.7.x.

![Screenshot of the PbtA system](https://mattsmithin-files.s3.amazonaws.com/pbta-system.png)

# Description

Build campaigns compatible with (most) [Powered by the Apocalypse RPGs](http://apocalypse-world.com/pbta/) using Foundry VTT! This system is in active development, and it currently has three versions: a public beta version, a patreon beta version, and a patreon alpha version. There is no difference between the versions aside from the feature release cadence (described later in the Patreon section of this readme).

# Installation

To install the free beta version, use this manifest URL in Foundry's system installer.

**System Manifest:** [https://gitlab.com/asacolips-projects/foundry-mods/pbta/-/jobs/artifacts/beta/raw/system.json?job=build-beta](https://gitlab.com/asacolips-projects/foundry-mods/pbta/-/jobs/artifacts/beta/raw/system.json?job=build-beta)

To install a patreon alpha or beta version, follow the instructions available via the Iron Moose Development patreon and/or Discord server.

# Usage

Go to the [documentation](https://asacolips.gitbook.io/pbta-system/) for more details on how to use and configure the system once have it installed.

# Supporting Development at Patreon

If you would like to support the development of this system and get access to its new features sooner, you can subscribe to the [Iron Moose Development Patreon](https://www.patreon.com/ironmoose), and where you can get Patreon alpha and/or beta access to the PbtA system, along with several other systems and modules!

Release cycles for the project follow this pattern:

1. Patreon alpha version releases with new features.
2. One week later, the patreon beta version releases with those same features (along with bug fixes).
3. Two weeks later (three weeks since alpha), the new features will be released in a new public beta version.

# Contributing

This project is accepting issue reports and code merge requests! See the [CONTRIBUTING.MD](https://gitlab.com/asacolips-projects/foundry-mods/pbta/-/blob/beta/CONTRIBUTING.md) page for details. Community code contributes will bypass the Patreon release structure and go directly to the public beta version once they're approved and merged.

## Translations

If you would like to contribute translations directly to the system, they're written using YAML and are under `src/yaml/lang`, and the repo includes build tools to convert them back into JSON. If you prefer writing in JSON, you can convert from JSON to YAML at https://www.json2yaml.com/

## Running builds

This repo includes a `src` directory with all of its actual code, and it compiles that to a `dist` directory that's ignored by the repo's gitignore.

To build the project, you'll need the current LTS version of [Node.js](https://nodejs.org/en/) (or the current release, if preferred) installed. From there, you can build with the following commands in the root of the repo:

```
npm ci
npm run build
```

There are several additional run commands defined in the scripts section of `package.json`, but the build command will run all relevant Gulp tasks. If you would prefer to run the compiler constantly, you can instead use `npm run watch` to do the same thing and watch for new changes.

Once the repo has been built, you should symlink the contents of the `dist` directory to your Foundry installation's systems directory using the name `pbta` for the linked directory.
# Licensing

All HTML, CSS, and JS is licensed under the [MIT license](https://gitlab.com/asacolips-projects/foundry-mods/dungeonworld/-/raw/master/LICENSE.txt).
