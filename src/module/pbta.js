/**
 * A simple and flexible system for world-building using an arbitrary collection of character and item attributes
 * Author: Atropos
 * Software License: GNU GPLv3
 */

// Import Modules
import { PBTA } from "./config.js";
import { registerSettings } from "./settings.js";

import * as applications from "./applications/_module.js";
import * as dataModels from "./data/_module.js";
import * as dice from "./dice/_module.js";
import * as documents from "./documents/_module.js";
import * as migrations from "./migration.js";
import * as utils from "./utils.js";

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */

globalThis.pbta = {
	applications,
	config: PBTA,
	dataModels,
	dice,
	documents,
	migrations,
	utils,
};

Hooks.once("init", async function () {
	globalThis.pbta = game.pbta = Object.assign(game.system, globalThis.pbta);

	CONFIG.ui.combat = applications.combat.PbtACombatTracker;
	CONFIG.Combatant.documentClass = documents.CombatantPbtA;

	// Define DataModels
	CONFIG.Actor.dataModels.character = dataModels.CharacterData;
	CONFIG.Actor.dataModels.npc = dataModels.NpcData;
	CONFIG.Actor.dataModels.other = dataModels.OtherData;

	CONFIG.Item.dataModels.equipment = dataModels.EquipmentData;
	CONFIG.Item.dataModels.move = dataModels.MoveData;
	CONFIG.Item.dataModels.npcMove = dataModels.NpcMoveData;
	CONFIG.Item.dataModels.playbook = dataModels.PlaybookData;
	CONFIG.Item.dataModels.tag = dataModels.ItemData;

	game.socket.on("system.pbta", (data) => {
		if (game.user.isGM && data.combatantUpdate) {
			game.combat.updateEmbeddedDocuments("Combatant", Array.isArray(data.combatantUpdate) ? data.combatantUpdate : [data.combatantUpdate]);
			ui.combat.render();
		}
	});

	CONFIG.Dice.RollPbtA = dice.RollPbtA;
	CONFIG.Dice.rolls.push(dice.RollPbtA);

	CONFIG.PBTA = PBTA;
	CONFIG.Actor.documentClass = documents.ActorPbta;
	CONFIG.Item.documentClass = documents.ItemPbta;

	// Register sheet application classes
	Actors.unregisterSheet("core", ActorSheet);
	Actors.registerSheet("pbta", applications.actor.PbtaActorSheet, {
		types: ["character"],
		makeDefault: true,
		label: "PBTA.SheetClassCharacter"
	});
	Actors.registerSheet("pbta", applications.actor.PbtaActorOtherSheet, {
		types: ["other"],
		makeDefault: true,
		label: "PBTA.SheetClassOther"
	});
	Actors.registerSheet("pbta", applications.actor.PbtaActorNpcSheet, {
		types: ["npc"],
		makeDefault: true,
		label: "PBTA.SheetClassNPC"
	});
	Items.unregisterSheet("core", ItemSheet);
	Items.registerSheet("pbta", applications.item.PbtaItemSheet, {
		makeDefault: true,
		label: "PBTA.SheetClassItem"
	});

	utils.registerHandlebarsHelpers();

	// Preload template partials.
	utils.preloadHandlebarsTemplates();
});

Hooks.on("i18nInit", () => {
	registerSettings();

	// Build out character data structures.
	const pbtaSettings = game.settings.get("pbta", "sheetConfig");

	// Retrieve overridden config, if enabled.
	if (pbtaSettings?.overridden && game.settings.get("pbta", "sheetConfigOverride")) {
		game.pbta.sheetConfig = pbtaSettings.overridden;
	} else if (pbtaSettings?.computed) {
		// Otherwise, retrieve computed config.
		game.pbta.sheetConfig = utils.convertSheetConfig(pbtaSettings.computed);
	} else {
		// Fallback to empty config.
		game.pbta.sheetConfig = pbtaSettings;
	}
});

/**
 * This function runs after game data has been requested and loaded from the servers, so documents exist
 */
Hooks.once("setup", function () {
	// Localize CONFIG objects once up-front
	const toLocalize = [];
	for (let o of toLocalize) {
		CONFIG.PBTA[o] = Object.entries(CONFIG.PBTA[o]).reduce((obj, e) => {
			obj[e[0]] = game.i18n.localize(e[1]);
			return obj;
		}, {});
	}

	if (game.user.isGM && !game.settings.get("pbta", "hideSidebarButtons")) {
		Hooks.on("renderSettings", (app, html) => {
			let settingsButton = $(`<button id="pbta-settings-btn" data-action="pbta-settings">
				<i class="fas fa-file-alt"></i> ${game.i18n.localize("PBTA.Settings.sheetConfig.label")}
			</button>`);
			html.find('button[data-action="configure"]').before(settingsButton);

			let helpButton = $(`<button id="pbta-help-btn" data-action="pbta-help">
				<i class="fas fa-question-circle"></i> ${game.i18n.localize("PBTA.Settings.button.help")}
			</button>`);
			html.find('button[data-action="controls"]').after(helpButton);

			settingsButton.on("click", (ev) => {
				ev.preventDefault();
				let menu = game.settings.menus.get("pbta.sheetConfigMenu");
				let app = new menu.type();
				app.render(true);
			});

			helpButton.on("click", (ev) => {
				ev.preventDefault();
				window.open("https://asacolips.gitbook.io/pbta-system/", "pbtaHelp", "width=1032,height=720");
			});
		});
	}
});

Hooks.once("ready", async function () {
	// Override sheet config.
	if (game.user.isGM) {
		// Store default actor types for later.
		game.pbta.defaultModel = game.system.model;

		// Force sheet config override off, unless a module changes it.
		await game.settings.set("pbta", "sheetConfigOverride", false);

		// Allow modules to override the sheet config.
		Hooks.callAll("pbtaSheetConfig");

		// @todo find something better than this timeout hack.
		const timeout = 1000;
		setTimeout(() => {
			// Retrieve the previous configuration.
			let existingConfig = game.settings.get("pbta", "sheetConfig") ?? {};
			// @todo hack to fix the old the default value. Remove in a future update.
			if (typeof existingConfig !== "object") {
				existingConfig = {};
			}
			// If a module enabled the override, assign it to the config so that player
			// clients can use it without the GM being logged in.
			if (game.settings.get("pbta", "sheetConfigOverride")) {
				existingConfig.overridden = game.pbta.sheetConfig;
				game.settings.set("pbta", "sheetConfig", existingConfig);
			} else if (existingConfig?.overridden) {
				// Otherwise, delete the override config.

				// If not tomlString exists, delete the config outright to prevent
				// it from being malformed.
				if (!existingConfig?.tomlString) {
					ui.notifications.info(game.i18n.localize("PBTA.Messages.sheetConfig.overrideRemoved"));
					existingConfig = null;
				} else {
					// Otherwise, restore the previous config.

					// Delete overrides.
					delete existingConfig.overridden;
					delete existingConfig.computed;
					// Restore computed config and reapply.
					existingConfig.computed = utils.parseTomlString(existingConfig.tomlString);
					game.pbta.sheetConfig = utils.convertSheetConfig(existingConfig.computed);
					utils.applyActorTemplates(true);
					ui.notifications.info(game.i18n.localize("PBTA.Messages.sheetConfig.previousSettingRestored"));
				}
				game.settings.set("pbta", "sheetConfig", existingConfig);
			}
		}, timeout);
	}

	// Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
	Hooks.on("hotbarDrop", (bar, data, slot) => documents.macro.createPbtaMacro(data, slot));

	CONFIG.PBTA = PBTA;

	utils.getPlaybooks();

	// Apply structure to actor types.
	utils.applyActorTemplates();

	// Run migrations.
	if (!game.user.isGM) return;
	const cv = game.settings.get("pbta", "systemMigrationVersion");
	const totalDocuments = game.actors.size + game.scenes.size + game.items.size;
	if (!cv && totalDocuments === 0) return game.settings.set("pbta", "systemMigrationVersion", game.system.version);
	if (cv && !isNewerVersion(game.system.flags.needsMigrationVersion, cv)) return;

	// Perform the migration
	migrations.migrateWorld();
});

Hooks.on("renderChatMessage", (data, html, options) => {
	if (game.settings.get("pbta", "autoCollapseItemCards")) {
		html.find(".card-content").hide();
	}
	if (game.settings.get("pbta", "autoCollapseItemCardsResult")) {
		html.find(".result-details").hide();
		html.find(".result-choices").hide();
	}
	const cardButtons = html.find(".pbta-chat-card .card-buttons");
	if (!game.user.isGM || !game.pbta.sheetConfig?.rollShifting) {
		cardButtons.hide();
	}
});

Hooks.on("renderChatLog", (app, html, data) => documents.ItemPbta.chatListeners(html));
Hooks.on("renderChatPopout", (app, html, data) => documents.ItemPbta.chatListeners(html));
