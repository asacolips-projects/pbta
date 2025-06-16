import { PbtaSettingsConfigDialog } from "./forms/sheet-config.js";
import { PbtaTagConfigDialog } from "./forms/tag-config.js";

/**
 * Register all of the system's settings.
 */
export function registerSettings() {
	game.settings.registerMenu("pbta", "sheetConfigMenu", {
		name: game.i18n.localize("PBTA.Settings.sheetConfig.name"),
		label: game.i18n.localize("PBTA.Settings.sheetConfig.title"),
		hint: game.i18n.localize("PBTA.Settings.sheetConfig.hint"),
		icon: "fas fa-file-alt",               // A Font Awesome icon used in the submenu button
		type: PbtaSettingsConfigDialog,   // A FormApplication subclass which should be created
		restricted: true,                   // Restrict this submenu to gamemaster only?
		scope: "world"
	});

	game.settings.registerMenu("pbta", "tagConfigMenu", {
		name: game.i18n.localize("PBTA.Settings.tagConfig.name"),
		label: game.i18n.localize("PBTA.Settings.tagConfig.label"),
		hint: game.i18n.localize("PBTA.Settings.tagConfig.hint"),
		icon: "fas fa-tag",               // A Font Awesome icon used in the submenu button
		type: PbtaTagConfigDialog,   // A FormApplication subclass which should be created
		restricted: true,                   // Restrict this submenu to gamemaster only?
		scope: "world"
	});

	/**
	 * Track the system version upon which point a migration was last applied
	 */
	game.settings.register("pbta", "systemMigrationVersion", {
		name: "System Migration Version",
		scope: "world",
		config: false,
		type: String,
		default: ""
	});

	game.settings.register("pbta", "autoCollapseItemCards", {
		name: "PBTA.Settings.AutoCollapseCard.name",
		hint: "PBTA.Settings.AutoCollapseCard.hint",
		scope: "client",
		config: true,
		default: false,
		type: Boolean
	});

	game.settings.register("pbta", "autoCollapseItemCardsResult", {
		name: "PBTA.Settings.AutoCollapseCardResult.name",
		hint: "PBTA.Settings.AutoCollapseCardResult.hint",
		scope: "client",
		config: true,
		default: false,
		type: Boolean
	});

	game.settings.register("pbta", "advForward", {
		name: game.i18n.localize("PBTA.Settings.advForward.name"),
		hint: game.i18n.localize("PBTA.Settings.advForward.hint"),
		scope: "world",
		config: true,
		type: Boolean,
		default: false
	});

	game.settings.register("pbta", "hideRollFormula", {
		name: game.i18n.localize("PBTA.Settings.hideRollFormula.name"),
		hint: game.i18n.localize("PBTA.Settings.hideRollFormula.hint"),
		scope: "world",
		config: true,
		type: Boolean,
		default: false
	});

	game.settings.register("pbta", "hideForward", {
		name: game.i18n.localize("PBTA.Settings.hideForward.name"),
		hint: game.i18n.localize("PBTA.Settings.hideForward.hint"),
		scope: "world",
		config: true,
		type: Boolean,
		default: false
	});

	game.settings.register("pbta", "hideHold", {
		name: game.i18n.localize("PBTA.Settings.hideHold.name"),
		hint: game.i18n.localize("PBTA.Settings.hideHold.hint"),
		scope: "world",
		config: true,
		type: Boolean,
		default: false
	});

	game.settings.register("pbta", "hideOngoing", {
		name: game.i18n.localize("PBTA.Settings.hideOngoing.name"),
		hint: game.i18n.localize("PBTA.Settings.hideOngoing.hint"),
		scope: "world",
		config: true,
		type: Boolean,
		default: false
	});

	game.settings.register("pbta", "hideRollMode", {
		name: game.i18n.localize("PBTA.Settings.hideRollMode.name"),
		hint: game.i18n.localize("PBTA.Settings.hideRollMode.hint"),
		scope: "world",
		config: true,
		type: Boolean,
		default: false
	});

	game.settings.register("pbta", "hideUses", {
		name: game.i18n.localize("PBTA.Settings.hideUses.name"),
		hint: game.i18n.localize("PBTA.Settings.hideUses.hint"),
		scope: "world",
		config: true,
		type: Boolean,
		default: true
	});

	game.settings.register("pbta", "hideAdvancement", {
		name: game.i18n.localize("PBTA.Settings.hideAdvancement.name"),
		hint: game.i18n.localize("PBTA.Settings.hideAdvancement.hint"),
		scope: "world",
		config: true,
		type: String,
		choices: {
			none: "PBTA.Settings.hideAdvancement.OptNone",
			input: "PBTA.Settings.hideAdvancement.OptInput",
			both: "PBTA.Settings.hideAdvancement.OptBoth"
		},
		default: "none",
		onChange: (value) => ui.actors.render()
	});

	game.settings.register("pbta", "sheetConfig", {
		name: "PBTA Sheet Config",
		scope: "world",
		config: false,
		type: Object,
		default: {
			tomlString: "rollFormula = \"2d6\"\nstatToggle = false\n\n# Define roll result ranges.\n[rollResults]\n  [rollResults.failure]\n    range = \"6-\"\n    label = \"Complications...\"\n  [rollResults.partial]\n    range = \"7-9\"\n    label = \"Partial success\"\n  [rollResults.success]\n    range = \"10\" # or \"10-12\" if using crits\n    label = \"Success!\"\n  [rollResults.critical]\n    range = false # or \"13+\" to enable\n    label = \"Critical Success!\"\n\n########################################\n## CHARACTERS ##########################\n########################################\n[character]\n\n  # Define stats.\n  [character.stats]\n    cool = \"Cool\"\n    hard = \"Hard\"\n    hot = \"Hot\"\n    sharp = \"Sharp\"\n    weird = \"Weird\"\n\n  # Define attributes.\n  [character.attributesTop]\n    [character.attributesTop.armor]\n      type = \"Number\"\n    [character.attributesTop.harm]\n      type = \"Clock\"\n      max = 32\n    [character.attributesTop.improvement]\n      type = \"Xp\"\n      max = 5\n    [character.attributesTop.customResource]\n      type = \"Resource\"\n      label = \"Custom Resource\"\n\n  # Define sidebar details.\n  [character.attributesLeft]\n    look = \"LongText\"\n    hx = \"LongText\"\n    number = \"Number\"\n    text = \"Text\"\n    [character.attributesLeft.toggle]\n\t    type = \"Checkbox\"\n      label = \"Toggle\"\n      checkboxLabel = \"Test Label\"\n      \n  # Define equipment types\n  [character.equipmentTypes]\n    gear = \"Gear\"\n\n  # Define logical groups for moves.\n  [character.moveTypes]\n    basic = \"Basic\"\n    advanced = \"Advanced\"\n\n########################################\n## NPCS ################################\n########################################\n# Define stats.\n[npc]\n  stats = false\n\n  # Define attributes.\n  [npc.attributesTop]\n    [npc.attributesTop.armor]\n      type = \"Number\"\n    [npc.attributesTop.harm]\n      type = \"Clock\"\n      max = 6\n    [npc.attributesTop.damage]\n      type = \"Roll\"\n      default = \"d10\"\n\n  [npc.attributesLeft]\n    [npc.attributesLeft.bio]\n      type = \"LongText\"\n\n  # Define equipment types\n  [npc.equipmentTypes]\n    gear = \"Gear\"\n    \n  # Define logical groups for moves.\n  [npc.moveTypes]\n    basic = \"Basic\"",
			computed: {
				rollFormula: "2d6",
				statToggle: false,
				rollResults: {
					failure: {
						range: "6-",
						label: "Complications..."
					},
					partial: {
						range: "7-9",
						label: "Partial success"
					},
					success: {
						range: "10",
						label: "Success!"
					},
					critical: {
						range: false,
						label: "Critical Success!"
					}
				},
				character: {
					stats: {
						cool: "Cool",
						hard: "Hard",
						hot: "Hot",
						sharp: "Sharp",
						weird: "Weird"
					},
					attributesTop: {
						armor: {
							type: "Number"
						},
						harm: {
							type: "Clock",
							max: 32
						},
						improvement: {
							type: "Xp",
							max: 5
						},
						customResource: {
							type: "Resource",
							label: "Custom Resource"
						}
					},
					attributesLeft: {
						look: "LongText",
						hx: "LongText",
						number: "Number",
						text: "Text",
						toggle: {
							type: "Checkbox",
							label: "Toggle",
							checkboxLabel: "Test Label"
						}
					},
					equipmentTypes: {
						gear: "Gear"
					},
					moveTypes: {
						basic: "Basic",
						advanced: "Advanced"
					}
				},
				npc: {
					stats: false,
					attributesTop: {
						armor: {
							type: "Number"
						},
						harm: {
							type: "Clock",
							max: 6
						},
						damage: {
							type: "Roll",
							default: "d10"
						}
					},
					attributesLeft: {
						bio: {
							type: "LongText"
						}
					},
					equipmentTypes: {
						gear: "Gear"
					},
					moveTypes: {
						basic: "Basic"
					}
				}
			}
		}
	});

	game.settings.register("pbta", "sheetConfigOverride", {
		name: "Override PBTA Sheet Config",
		scope: "world",
		config: false,
		type: Boolean,
		default: false
	});

	game.settings.register("pbta", "tagConfig", {
		name: "PBTA Tag Config",
		scope: "world",
		config: false,
		type: Object,
		default: {
			general: "",
			actor: {
				all: ""
			},
			item: {
				all: "",
				equipment: ""
			}
		}
	});
}
