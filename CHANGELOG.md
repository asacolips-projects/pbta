# 0.8.2

## Features and Changes

- Added support for token instead of stats, for games like Apocalypse keys and Libreté. character.stats block should have token = true, label = "token name", an optional default = [number] which define the default token value for new character and max = [number] which defines the max number of token a character can have.

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