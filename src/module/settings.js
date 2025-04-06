import { PbtaSettingsConfigDialog } from "./forms/sheet-config.js";
import { PbtaTagConfigDialog } from "./forms/tag-config.js";

/**
 * Register all of the system's settings.
 */
export function registerSettings() {
	if (!game.pbta.moduleConfig) {
		game.settings.registerMenu("pbta", "sheetConfigMenu", {
			name: game.i18n.localize("PBTA.Settings.sheetConfig.name"),
			label: game.i18n.localize("PBTA.Settings.sheetConfig.title"),
			hint: game.i18n.localize("PBTA.Settings.sheetConfig.hint"),
			icon: "fas fa-file-alt",               // A Font Awesome icon used in the submenu button
			type: PbtaSettingsConfigDialog,   // A FormApplication subclass which should be created
			restricted: true,                   // Restrict this submenu to gamemaster only?
			scope: "world"
		});
	}
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
		onChange: (value) => ui.sidebar.tabs.actors.render()
	});

	game.settings.register("pbta", "sheetConfig", {
		name: "PBTA Sheet Config",
		scope: "world",
		config: false,
		type: Object,
		default: {}
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
