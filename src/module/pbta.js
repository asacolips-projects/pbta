import { PBTA } from "./config.js";
import { registerSettings } from "./settings.js";

import * as applications from "./applications/_module.js";
import * as canvas from "./canvas/_module.js";
import * as dataModels from "./data/_module.js";
import * as dataFields from "./data/fields.js";
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
	dataFields,
	dice,
	documents,
	migrations,
	utils
};

Hooks.once("init", async function () {
	globalThis.pbta = game.pbta = Object.assign(game.system, globalThis.pbta);

	CONFIG.ui.actors = applications.sidebar.ActorDirectoryPbtA;
	CONFIG.ui.combat = applications.sidebar.PbtACombatTracker;
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

	if (game.user.isGM) {
		Hooks.on("renderSettings", (app, html) => {
			const header = document.createElement("h2");
			header.innerText = game.i18n.localize("Powered by the Apocalypse");

			const pbtaSettings = document.createElement("div");
			html.find("#settings-game")?.after(header, pbtaSettings);

			const buttons = [
				{
					action: (ev) => {
						ev.preventDefault();
						let menu = game.settings.menus.get("pbta.sheetConfigMenu");
						let app = new menu.type();
						app.render(true);
					},
					iconClasses: ["fas", "fa-file-alt"],
					label: "PBTA.Settings.sheetConfig.label"
				},
				{
					action: (ev) => {
						ev.preventDefault();
						window.open("https://asacolips.gitbook.io/pbta-system/", "pbtaHelp", "width=1032,height=720");
					},
					iconClasses: ["fas", "fa-question-circle"],
					label: "PBTA.Settings.button.help"
				}
			].map(({ action, iconClasses, label }) => {
				const button = document.createElement("button");
				button.type = "button";

				const icon = document.createElement("i");
				icon.classList.add(...iconClasses);

				button.append(icon, game.i18n.localize(label));

				button.addEventListener("click", action);

				return button;
			});

			pbtaSettings.append(...buttons);
		});
	}
});

Hooks.once("ready", async function () {
	// Override sheet config.
	if (game.user.isGM) {
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
	Hooks.on("hotbarDrop", (bar, data, slot) => {
		if (["Item"].includes(data.type)) {
			documents.macro.createPbtaMacro(data, slot);
			return false;
		}
	});

	if (!(game.modules.get("babele")?.active && game.i18n.lang !== "en")) {
		utils.getPlaybooks();
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
