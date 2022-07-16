# beta1-0.2.0

## BACK UP YOUR WORLD BEFORE TRYING THIS VERSION! THAR BE DANGER AFOOT!

This has some significant changes to sheetConfig settings dialog behind the scenes to add support for custom actor types, so there's a lot of room for it to potentially cause problems with existing data. I haven't encountered scenarios in my test worlds where I had data loss, but make sure you've got a way to get back to your original world via a backup if you do find issues that I missed.

--------------------------------------------------------------------------------

## Update Notes

- **Prevent refreshing the browser when canceling sheet config changes.** Previously, any time you closed the sheetConfig setting dialog, regardless of whether or not you made a change, it would cause the window to refresh. This has been adjusted so that it only does this if you submit the form and then confirm changes.
- **Add support for custom actor types.** There's now a new actor type called other that's used as an empty base to apply any number of custom actor types. You won't directly interact with the other actor type unless you're working in code via a module or macros, and you'll instead be able to create actors of that type by defining them in the sheetConfig setting. More details on how to do that below in the "How to define custom actor types" section. In addition, the documentation website will be updated once this feature goes into the public beta in roughly a week.
- **Added support for biography and equipment on NPCs.** The system now supports biography and equipment tabs on NPCs, similar to how they work on player characters. The NPC sheet has also been expanded slightly from 560px to 640px to accommodate the additional tabs.
- **Added support for roll overrides, forward, and ongoing.** There's now a new row of fields above the moves list in the moves tab that can be used to override the roll formula used on moves for that character, or to add a forward/ongoing bonus to their rolls. Forward bonuses are automatically reset to 0 after the roll is completed.
- **Added (partial) support for Foundry 0.8.2.** This is the first version of the system to support Foundry 0.8.1 or higher, while retaining support for Foundry 0.7.9. The majoirty of the system should work with Foundry 0.8.2 at this point, but the custom actor type feature is not yet working with it and needs further development.

## Bug Fixes

- **Fixed compendium imports and exports**. The logic that was being used to apply the sheetConfig TOML settings to actors/items on creation was too aggressive, and it was unsetting pre-existing values when duplicating actors/items or when importing them from a compendium. That has been fixed in this version (and has also been pushed out to the public beta version).
- **Fixed code at the bottom of playbooks.** There was a small typo that caused a code comment to be rendered at the bottom of the playbook item form.

## How to define custom actor types
To define a custom actor type, you use the same structure as either characters or npcs, but you use your custom actor type name instead of character or npc in all of your properties. In addition, there's an optional baseType property on custom actor types to choose whether it should use the character sheet as its base (meaning wider and with support for stats) or the npc sheet.

The following example would be added to the end of your sheetConfig TOML after all of your other settings.

```toml
########################################
## Custom Actor Types ##################
########################################
[foobar]
  baseType = 'npc'
  # Define attributes.
  [foobar.attributesTop]
    [foobar.attributesTop.harm]
      type = "Resource"
      label = "Harm"
    [foobar.attributesTop.gender]
      type = "Text"
      label = "Gender"
    [foobar.attributesTop.age]
      type = "Text"
      label = "Age"

  [foobar.attributesLeft]
    [foobar.attributesLeft.look]
      type = "LongText"
      label = "Look"
    [foobar.attributesLeft.drive]
      type = "LongText"
      label = "Drive"

  # Define logical groups for moves.
  [foobar.moveTypes]
    mc = "MC Moves"

[ipsum]
  baseType = 'character'
  [ipsum.stats]
    lorem = "Lorem"
    ipsum = "Ipsum"
    dolor = "Dolor"
    sit = "Sit"
    amet = "Amet"

  # Define attributes.
  [ipsum.attributesTop]
    [ipsum.attributesTop.power]
      type = "Number"
      label = "Power"

  [ipsum.attributesLeft]
    [ipsum.attributesLeft.look]
      type = "LongText"
      label = "Look"
    [ipsum.attributesLeft.drive]
      type = "LongText"
      label = "Drive"

  # Define logical groups for moves.
  [ipsum.moveTypes]
    lorem = "Lorem Moves"
    ipsum = "Ipsum Moves"
```