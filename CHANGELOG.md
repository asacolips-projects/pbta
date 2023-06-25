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