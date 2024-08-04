/**
 * A simple and flexible system for world-building using an arbitrary collection of character and item attributes
 * Author: Atropos
 * Software License: GNU GPLv3
 */

// Import Modules
import { PBTA } from "./config.js";
import { registerSettings } from "./settings.js";

import * as applications from "./applications/_module.js";
import * as canvas from "./canvas/_module.js";
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
	canvas,
	config: PBTA,
	dataModels,
	dice,
	documents,
	migrations,
	utils
};

Hooks.once("init", () => {
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
	CONFIG.Token.objectClass = canvas.TokenPbta;

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
	Items.unregisterSheet("pbta", applications.item.PbtaItemSheet, { types: ["playbook"] });
	Items.registerSheet("pbta", applications.item.PlaybookSheet, {
		makeDefault: true,
		types: ["playbook"],
		label: "PBTA.SheetClassPlaybook"
	});
	DocumentSheetConfig.unregisterSheet(CONFIG.Token.documentClass, "core", TokenConfig);
	DocumentSheetConfig.registerSheet(TokenDocument, "core", applications.token.PbtaTokenConfig, {
		makeDefault: true,
		label: () => game.i18n.format("SHEETS.DefaultDocumentSheet", { document: game.i18n.localize("DOCUMENT.Token") })
	});

	utils.registerHandlebarsHelpers();

	// Preload template partials.
	utils.preloadHandlebarsTemplates();
});

Hooks.on("i18nInit", () => {
	const activeModules = [...game.modules.entries()].filter(([key, m]) => m.active && m.flags[key]?.["pbta-override"]);

	if (activeModules.length > 1 && game.user.isGM) {
		const names = activeModules.map(([key, m]) => m.name).join(", ");
		ui.notifications.warn(game.i18n.format("PBTA.Warnings.TooManyModules", { names }));
	}
	game.pbta.moduleConfig = activeModules.length > 0;

	registerSettings();

	// Build out character data structures.
	const pbtaSettings = game.settings.get("pbta", "sheetConfig");

	if (pbtaSettings.overridden && game.pbta.moduleConfig) {
		game.pbta.sheetConfig = pbtaSettings.overridden;
	} else if (pbtaSettings.computed) {
		game.pbta.sheetConfig = utils.convertSheetConfig(pbtaSettings.computed);
	} else {
		game.pbta.sheetConfig = pbtaSettings;
	}
});

/**
 * This function runs after game data has been requested and loaded from the servers, so documents exist
 */
Hooks.once("setup", () => {
	// Localize CONFIG objects once up-front
	const toLocalize = [];
	for (let o of toLocalize) {
		CONFIG.PBTA[o] = Object.entries(CONFIG.PBTA[o]).reduce((obj, e) => {
			obj[e[0]] = game.i18n.localize(e[1]);
			return obj;
		}, {});
	}

	if (!game.modules.get("babele")?.active) {
		utils.getPlaybooks();
	}
});

Hooks.once("ready", () => {
	// Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
	Hooks.on("hotbarDrop", (bar, data, slot) => {
		if (["Item"].includes(data.type)) {
			documents.macro.createPbtaMacro(data, slot);
			return false;
		}
	});

	if (game.user.isGM) {
		Hooks.callAll("pbta.sheetConfig");
		let existingConfig = game.settings.get("pbta", "sheetConfig") ?? {};
		const { overridden, tomlString } = existingConfig;
		if (game.pbta.moduleConfig) {
			existingConfig.overridden = game.pbta.sheetConfig;
		} else if (overridden) {
			if (!tomlString) {
				ui.notifications.info(game.i18n.localize("PBTA.Messages.sheetConfig.overrideRemoved"));
				existingConfig = {};
			} else {
				delete existingConfig.overridden;

				existingConfig.computed = utils.parseTomlString(existingConfig.tomlString);
				game.pbta.sheetConfig = utils.convertSheetConfig(existingConfig.computed);
				utils.applyActorTemplates(true);
				ui.notifications.info(game.i18n.localize("PBTA.Messages.sheetConfig.previousSettingRestored"));
			}
		}
		game.settings.set("pbta", "sheetConfig", existingConfig);
	}

	// Apply structure to actor types.
	utils.applyActorTemplates();

	_configureTrackableAttributes();

	// Run migrations.
	if (!game.user.isGM) return;
	const cv = game.settings.get("pbta", "systemMigrationVersion");
	const totalDocuments = game.actors.size + game.scenes.size + game.items.size;
	if (!cv && totalDocuments === 0) return game.settings.set("pbta", "systemMigrationVersion", game.system.version);
	if (cv && !foundry.utils.isNewerVersion(game.system.flags.needsMigrationVersion, cv)) return;

	// Perform the migration
	migrations.migrateWorld();
});

Hooks.once("babele.ready", () => {
	// It is a mystery why Babele calls "babele.ready" twice
	Hooks.once("babele.ready", () => utils.getPlaybooks());
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
Hooks.on("renderSettings", (app, html) => {
	if (!game.user.isGM) return;
	const header = document.createElement("h2");
	header.innerText = game.i18n.localize("Powered by the Apocalypse");

	const pbtaSettings = document.createElement("div");
	html.find("#settings-game")?.after(header, pbtaSettings);

	const buttons = [
		{
			action: (ev) => {
				ev.preventDefault();
				window.open("https://asacolips.gitbook.io/pbta-system/", "pbtaHelp", "width=1032,height=720");
			},
			iconClasses: ["fas", "fa-question-circle"],
			label: "PBTA.Settings.button.help"
		}
	];
	if (!game.pbta.moduleConfig) {
		buttons.unshift({
			action: (ev) => {
				ev.preventDefault();
				let menu = game.settings.menus.get("pbta.sheetConfigMenu");
				let app = new menu.type();
				app.render(true);
			},
			iconClasses: ["fas", "fa-file-alt"],
			label: "PBTA.Settings.sheetConfig.label"
		});
	}
	const formattedButtons = buttons.map(({ action, iconClasses, label }) => {
		const button = document.createElement("button");
		button.type = "button";

		const icon = document.createElement("i");
		icon.classList.add(...iconClasses);

		button.append(icon, game.i18n.localize(label));

		button.addEventListener("click", action);

		return button;
	});

	pbtaSettings.append(...formattedButtons);
});

/**
 * Configure explicit lists of attributes that are trackable on the token HUD and in the combat tracker.
 * @internal
 */
function _configureTrackableAttributes() {
	const trackableAttributes = {};
	if (game.pbta.sheetConfig.actorTypes) {
		for (const [key, data] of Object.entries(game.pbta.sheetConfig.actorTypes)) {
			trackableAttributes[key] = {
				bar: [],
				value: []
			};

			for (const attr of ["attributes", "attrLeft", "attrTop"]) {
				for (const [attrK, attrV] of Object.entries(data?.[attr] ?? [])) {
					if (attrV.type === "Clock" || attrV.type === "Resource") {
						trackableAttributes[key].bar.push(`attributes.${attrK}`);
					} else if (attrV.type === "Number") {
						trackableAttributes[key].value.push(`attributes.${attrK}.value`);
					}
				}
			}
		}
	}

	CONFIG.Actor.trackableAttributes = trackableAttributes;
}
