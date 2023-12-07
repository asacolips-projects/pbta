import { PbtaPlaybooks } from "../config.js";

/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export class PbtaItemSheet extends ItemSheet {
	constructor(...args) {
		super(...args);
		if (this.object.type === "playbook") {
			this.options.classes.push("class");
			this.options.width = this.position.width = 780;
			this.options.tabs[0].initial = "description";
		}
	}

	/** @override */
	static get defaultOptions() {
		return mergeObject(super.defaultOptions, {
			classes: ["pbta", "sheet", "item"],
			width: 520,
			height: 480,
			tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "details" }]
		});
	}

	/* -------------------------------------------- */

	/** @override */
	get template() {
		const path = "systems/pbta/templates/items";
		return `${path}/${this.item.type}-sheet.html`;
	}

	/* -------------------------------------------- */

	/** @override */
	async getData() {
		let isOwner = false;
		let isEditable = this.isEditable;
		let context = this.item.toObject(false);
		let effects = {};
		const actor = this.actor;

		this.options.title = this.document.name;
		isOwner = this.document.isOwner;
		isEditable = this.isEditable;

		// Copy Active Effects
		effects = this.item.effects.map((e) => foundry.utils.deepClone(e));
		context.effects = effects;

		context.dtypes = ["String", "Number", "Boolean"];
		// Add playbooks.
		context.system.playbooks = await PbtaPlaybooks.getPlaybooks();

		// Handle rich text fields.
		const enrichmentOptions = {
			secrets: false,
			documents: true,
			links: true,
			rolls: true,
			rollData: actor?.getRollData() ?? {},
			async: true,
			relativeTo: actor ?? null
		};

		if (context.system?.description) {
			context.system.description = await TextEditor.enrichHTML(context.system.description, enrichmentOptions);
		}

		if (this.item.type === "move" || this.item.type === "npcMove") {
			if (this.item.type === "move") {
				if (game.pbta.sheetConfig?.actorTypes[actor?.baseType]?.stats) {
					context.system.stats = duplicate(game.pbta.sheetConfig.actorTypes[actor?.baseType].stats);
				} else {
					context.system.stats = {};
				}
				context.system.stats.prompt = {label: game.i18n.localize("PBTA.Prompt")};
				if (Object.keys(context.system.stats).length > 1) {
					context.system.stats.ask = {label: game.i18n.localize("PBTA.Ask")};
				}
				context.system.stats.formula = {label: game.i18n.localize("PBTA.Formula")};

				if (context.system?.choices) {
					context.system.choices = await TextEditor.enrichHTML(context.system.choices, enrichmentOptions);
				}
			} else if (this.item.type === "npcMove") {
				context.system.rollExample = game.pbta.sheetConfig?.rollFormula ?? "2d6";
			}
			context.system.moveTypes = game.pbta.sheetConfig?.actorTypes[actor?.baseType]?.moveTypes ?? {};
			for (let [key, moveResult] of Object.entries(context.system.moveResults)) {
				context.system.moveResults[key].rangeName = `system.moveResults.${key}.value`;
				context.system.moveResults[key].value =
					await TextEditor.enrichHTML(moveResult.value, enrichmentOptions);
			}
		} else if (this.item.type === "equipment") {
			context.system.equipmentTypes = game.pbta.sheetConfig?.actorTypes[actor?.baseType]?.equipmentTypes ?? null;
		}

		return {
			item: this.item,
			cssClass: isEditable ? "editable" : "locked",
			editable: isEditable,
			system: context.system,
			effects: effects,
			limited: this.item.limited,
			options: this.options,
			owner: isOwner,
			title: context.name
		};
	}

	/* -------------------------------------------- */

	/** @override */
	async activateListeners(html) {
		super.activateListeners(html);

		// Activate tabs
		let tabs = html.find(".tabs");
		let initial = this._sheetTab;
		new TabsV2(tabs, {
			initial: initial,
			callback: (clicked) => this._sheetTab = clicked.data("tab")
		});

		this._tagify(html, this.options.editable);

		// Everything below here is only needed if the sheet is editable
		if (!this.options.editable) {
			return;
		}

		this.html = html;

		// TODO: Create tags that don't already exist on focus out. This is a
		// nice-to-have, but it's high risk due to how easy it will make it to
		// create extra tags unintentionally.
	}

	/**
	 * Add tagging widget.
	 * @param {HTMLElement} html
	 * @param {boolean} editable
	 */
	async _tagify(html, editable) {
		// Build the tags list.
		let tags = game.items.filter((item) => item.type === "tag").map((item) => {
			return item.name;
		});
		for (let c of game.packs) {
			if (c.metadata.type && c.metadata.type === "Item" && c.metadata.name === "tags") {
				let items = c?.index ? c.index.map((indexedItem) => {
					return indexedItem.name;
				}) : [];
				tags = tags.concat(items);
			}
		}
		// Reduce duplicates.
		let tagNames = [];
		for (let tag of tags) {
			if (typeof tag === "string") {
				let tagName = tag.toLowerCase();
				if (tagNames.includes(tagName) === false) {
					tagNames.push(tagName);
				}
			}
		}

		// Sort the tagnames list.
		tagNames.sort((a, b) => {
			const aSort = a.toLowerCase();
			const bSort = b.toLowerCase();
			if (aSort < bSort) {
				return -1;
			}
			if (aSort > bSort) {
				return 1;
			}
			return 0;
		});

		// Tagify!
		let $input = html.find('input[name="system.tags"]');
		if ($input.length > 0) {
			if (!editable) {
				$input.attr("readonly", true);
			}

			// init Tagify script on the above inputs
			new Tagify($input[0], {
				whitelist: tagNames,
				maxTags: "Infinity",
				dropdown: {
					maxItems: 20,           // <- mixumum allowed rendered suggestions
					classname: "tags-look", // <- custom classname for this dropdown, so it could be targeted
					enabled: 0,             // <- show suggestions on focus
					closeOnSelect: false    // <- do not hide the suggestions dropdown once an item has been selected
				}
			});
		}
	}
}
