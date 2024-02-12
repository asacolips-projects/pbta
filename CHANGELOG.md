# 0.9.1

## Fixes
- Fixed "Ask" prompt on rolls being empty.
- Fixed importing Playbooks from Adventures.
- Updated README to include an example with multiple tags.

# 0.9.0

## Localization Improvements

- Updated pt-br translation (@brunocalado)
- Updated es translation (@WallaceMcGregor)
- "Equipment Type" and "Move Type" became "Category".

## Fixes
- Fixed adding/removing entire Attribute Groups (e.g. the whole Top/Left panel) not updating old actors.
- Fixed Stats not showing up on Move sheets (Closes #101, #102, #103).
- Fixed Roll Shifting rendering issues (Closes #100).
- Fixed Condition descriptions with certain number-dash combinations (e.g. "1-fatigue") being handled as bonuses (Closes 59).

## Changes
- Added support for the Automated Animations module.
- Refactored Item.roll method to only have one parameter. `descriptionOnly` is now a property of the options object.
- Equipments' "Post to Chat" icon changed to the "balloons" icon.
- Removed title attribute from img elements.
- Added Data Models (#91).
- Added `globalThis.pbta`, which is also accessible through `game.pbta` as before.
  - Added access to document sheets (`game.pbta.applications`) and roll handler (`game.pbta.dice`).
  - Moved documents to `game.pbta.documents`.
- Added `conditionCount` to RollData, which means it is now possible to make rolls such as `2d6 + @conditionCount`.
- Added `CONFIG.PBTA.playbooks`, which lists all playbooks available.
- Added attributes of type Clock, Resource and Number as Trackable Attributes for Tokens (Closes #105).
- Moved the system's Game Settings sidebar buttons to their own section and removed the system setting that hid them.
- Removed the icons that were bundled with the system since they are present on FoundryVTT. A migration will update documents to avoid broken links.

### Styling
- Reduced padding between listed items.
- Removed items list's margin.

### Playbook Improvements
- Added a Details tab to the Playbook sheet. Visible to GMs only.
  - Added PbtA ID (variable name: `slug`), which is an url-safe string meant to be unique among playbooks. It is meant to be used throughout the system and supporting modules.
  - Added Actor Type, described below on Item Sheet.
- A Playbook's PbtA ID is added as a CSS class to the Actor sheets as `.playbook-[PbtA ID]`.
  - For example: "The Chosen" becomes `playbook-the-chosen`.

### Actor Sheet
- Added a "limited" sheet which only shows an actor's name and its descriptions (Closes #95).
- Added "Stat Clock" feature. This adds a set number of buttons that simulates XP, for mechanics similar to Apocalypse World: Burned Over.
- Added "Stat Shift" feature. This adds a "Stat" to the list that let's you enhance a Stat up/down, for mechanics similar to the Masks.
- Added "Stat Token" feature to support games that use a token pool for stat rolls (Closes #92) (@s.paquay1, @mclemente)
- Added changing moves/equipments between categories by dragging and dropping them. This also works for items without a category being dropped onto the category (Closes #38).
- Replaced the Playbook's input with a selector.
- Moved the Stats' dice icons to the top of the box.
- Fixed Stat Toggle not adding the Stat's value.

### Item Sheet
- Added Actor Type field to Equipment, Move and Playbook items.
  - Visible only if not owned and if there are more than 1 valid actor type for the item.
  - Sets which actor type's data will be used to fill in fields such as Equipment Type and Move Type. On Playbook's case, it is used to differentiate between Playbooks that are exclusive to a certain actor type.

## Sheet Configuration

### Added "Stat Clocks" TOML configuration.
```toml
statClocks = 4
```
### Added "Stat Shifting" TOML configuration (Closes #96).
```toml
statShifting = true
# or
[statShifting]
  # Everything is optional. Values shown are the defaults for English localization
  label = "Stat Shift" # String shown on Character Sheet. Otherwise localize "{stat} Shift"
  value = 1 # The value to be shifted up/down
  stat = "Stat" # String used to localize the label
  stats = "Stats" # String used to localize "Character shifts {stats}" on Chat Message
```
### Added `playbook` property to actor attributes.
You can set either a playbook's name or slug (e.g. "The Chosen" or "the-chosen") and it will only be displayed if an actor has the chosen playbook.
```toml
[character.attributesTop.foo]
  type = "Clock"
  label = "Foo"
  playbook = "The Chosen" # or "the-chosen"
```
### The `moveTypes` can now be created as objects
For example, `[character.moveTypes.basic]`. Object moveTypes accept the following properties: `label`, `playbook`, `creation` (Closes #41).
```toml
[character.moveTypes.basic]
  label = "Basic Moves"
  creation = true # (Optional) Will add all Moves with this move type when creating a character.
  playbook = false # (Optional) Moves with this move type will display a Playbook field.
```
### Added a `description` attribute to actors
Adds new description editors to the Description tab when set (Closes #97).
```toml
[character.description.foo]
  label = "Foo" # The label shown if there are more than one description. Defaults to the key if not set (e.g. "foo").
  value = "Lorem ipsum" # (Optional. Default: "") The description's text when an actor is created.
  limited = false # (Optional, default: true) The visibility of this field on the Limited sheet.
```
### The ListOne and ListMany attributes now have an optional `sort` boolean property
When used, sort property will sort its options based on labels (#22).

```toml
[character.attributesTop.foo]
  type = "ListOne"
  label = "Foo"
  default = 1
  sort = true
  options = [
    "Option 1",
    "Option 2",
    "Option 3",
    "Option 4"
  ]
```

### Added `statToken` for stats with spendable tokens

Added a new `statToken` config that can be used to define a pool of tokens used for rolls made with that stat. To enable this, you'll need to add a `statToken` option to your TOML config defining the range for the pool, and a `token` entry into your `[character.stats]` option. See the example below:

```toml
# Single number.
statToken = 5
# OR define default, min, and max values.
[statToken]
  default = 0 # Optional, defaults to 0
  min = 0 # Optional, defaults to 0
  max = 5 # Optional, defaults to 1

[character.stats]
  # Define your regular stats as normal.
  strength = "Strength"
  speed = "Speed"
  magic = "Magic"
  # Token stat can also be defined, optionally, if you want to rename it.
  # Otherwise, a stat named "Token" will be added automatically.
  token = "Luck Token" 

```

## Development
- Added JSDoc to devDependencies to better document the project.
- Added a `#times` Handlebars helper that loops a block of code, similar to `#each`.
- (**BREAKING**) Added bundling to the JS files.
- Added sourcemap to the CSS.
- Added support for modules to include changes to the `DataModel.migrateData` by adding a function to `game.pbta.sheetMigration`.
- (**BREAKING**) Renamed Handlebars Partials.
- (**BREAKING**) `game.pbta.utils.getPlaybooks()` function has been refactored to only update the `CONFIG.PBTA.playbooks` list. To get the names/labels in the list (generally used for Item Sheets), use the new `game.pbta.utils.getPlaybookLabels()` function.
- (**BREAKING**) Migrated `actor.system.resources.rollFormula.value` to `actor.system.resources.rollFormula`.
- (**BREAKING**) Migrated `actor.system.details.playbook` to `actor.system.playbook`.
- (**BREAKING**) Migrated `actor.system.details.biography` to `actor.system.details.biography.value`.
- Removed duplicated `scripts/lib/codemirror.toml.js` in favor of the similar file under `module/forms`.

## Credits

Thanks go out to @mclemente, @s.paquay1, @brunocalado, and @WallaceMcGregor for their contributions in this release. Additionally, many thanks to our PbtA module developers who have worked hard to update their modules and help beta test this release!

# 0.8.1

## Features and Changes

- **Deprecation Warning** Added new tags setting configuration. This can be accessed under the PbtA settings and is separate from the TOML config setting. Tag settings are intended as a replacement for tag items and module devs should plan to replace their compendium tags by defining tags in `game.pbta.tagConfigOverride`. See the updated [README.md](https://gitlab.com/asacolips-projects/foundry-mods/pbta/-/blob/master/README.md) for an example.
- Added support for shifting results of rolls. To enable this, add `rollShifting = true` to your TOML config (at the same level as `rollFormula` and other global TOML settings).
- Added a Hide Sidebar buttons setting.
- Removed the ability to create Tag items and added a warning on Tag item sheets.
- Removed the "Welcome to the Alpha" header from the Sheet Configuration and update the notes.

## Bug Fixes
- Changed List's multi-checkbox to accept spaces in-between the label (e.g. `Condition | 3`).
- Fixed Speaker and RollMode not being set on rolls.
- Fixed Forward/Ongoing making rolls fail if no condition is set.
- Fixed NPC Move Rolls not showing Result Ranges.
- Fixed Stat Toggle only setting toggled stats' values to 0.

# 0.8.0

- Removed support for Foundry v10. Version 0.8.0 and above will be for Foundry v11+
- Added Tracks (@n1xx1)
- Added image to items based on their types.
- Added tooltips to Lists.
- Added support for the ListOne type (@s.paquay1).
- Improvements on the Combat tab, such as core Foundry features and some visual changes.
- Fixed Rolls failing when a condition is checked (@s.paquay1).
- Fixed removing an option from a ListOne/ListMany wouldn't remove it from actors.

Thanks to @mclemente, @n1xx1, and @s.paquay1 for their contributions in this release!

# 0.7.5

- Corrected encoding issue with German translation

# 0.7.4

- Fixed typos and incorrect terms in the French translation
- Added labels to sheets
- Removed legacy Dungeon World code that was unused in PbtA
- Fixed an issue where clocks weren't working after PbtA 0.7.3

Thanks to @tsukyu and @mclemente for their contributions in this release!

# 0.7.3

## Bug Fixes

- Added labels (`label`) to Actor types (#48, !42).
- Added modifiers bounds (`minMod` and `maxMod`) to sheet configs to limit modifiers within a certain threshold (!26).
- Added French localization (!28).
- Added a "Send to chat" button to Moves within Actor sheets (#69, !37).
- Added a "View Playbook" button next to the Playbook input on Actor Sheets that opens the playbook's sheet (#62, !36)
- Added a "Roll Mode" localization (!29).
- Added localization to Actor and Item types.
- Added blocking of unsupported items from being created on actor sheets (#88, !43).
- Changed tab visuals to make a sheet's selected tab to be the darker one (#56, !34).
- Fixed Clocks mutating data (#87, !43).
- Fixed pressing Enter changing Onward by -1 (#66, !42).
- Fixed creating nameless actors would throw an error instead of creating an actor with a default name (!41).
- Fixed conditions dialog opening on Moves without rolls (#68, !33).
- Fixed styling on chat messages that have a Choices section (#82, !42).
- Fixed an error thrown when opening NPC sheets in a world with tags (#88, !42)
- Removed migration text from Moves (#75, !31).

Thanks go to @wlonk and @s.paquay1 for their fixes in this release. A special thanks as well goes to @mclemente for additional fixes and for reviewing/merging open merge requests!

# 0.7.2

## Bug Fixes

- Fixed an issue where TOML sheet configurations wouldn't apply correctly on new worlds that hadn't yet had any TOML manually applied.

# 0.7.1

## Bug Fixes

- Added support for Foundry v11.
- Fixed an issue where TOML sheet configurations provided by modules wouldn't apply successfully for non-GM users.
- Updated spanish localization (thanks @WallaceMcGregor!)

# 0.7.0

## Features

- Added new `pbtaSheetConfig` hook to allow modules to override the sheet config and disable the TOML editor. See the [README](https://gitlab.com/asacolips-projects/foundry-mods/pbta/-/tree/master#overriding-sheet-config-in-a-module) for more information and example.

## New Translations

- German (@felodin.blutstein)
- Spanish (@elfonochasis)

## Bug Fixes

- Resolved issue with combatants not being able to be added to the combat tracker (@gonzaPaEst)

# 0.6.1

## Bug Fixes

- #78: Fixed an issue where enriched HTML (such as description or move results fields) didn't allow item links to be rendered correctly. One example of this issue was that if an item was created and then dropped into the description field of another item, it would output as plain text instead of as a link to the item.