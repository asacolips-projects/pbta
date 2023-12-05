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
		let context = this.object.toObject(false);
		let effects = {};
		let actor = null;

		this.options.title = this.document.name;
		isOwner = this.document.isOwner;
		isEditable = this.isEditable;
		// context = foundry.utils.deepClone(this.object.data);

		// Copy Active Effects
		effects = this.object.effects.map((e) => foundry.utils.deepClone(e));
		context.effects = effects;

		// Grab the parent actor, if any.
		actor = this.object?.parent;

		context.dtypes = ["String", "Number", "Boolean"];
		// Add playbooks.
		context.system.playbooks = await PbtaPlaybooks.getPlaybooks();

		// Add move types.
		let actorType = null;
		let itemType = this?.object?.type ?? "move";

		if (itemType === "move") {
			actorType = "character";
		} else if (itemType === "npcMove") {
			actorType = "npc";
		} else {
			actorType = "character";
		}

		// Handle actor types.
		let pbtaActorType = actorType;
		let pbtaSheetType = actorType;

		// Override with the parent actor if possible.
		if (actor) {
			pbtaActorType = actor.type;
			if (pbtaActorType === "other") {
				pbtaSheetType = actor.system?.customType ?? "character";
			} else {
				pbtaSheetType = pbtaActorType;
			}
		}

		if (itemType === "move") {
			if (game.pbta.sheetConfig?.actorTypes[pbtaSheetType]?.stats) {
				context.system.stats = duplicate(game.pbta.sheetConfig.actorTypes[pbtaSheetType].stats);
			} else {
				context.system.stats = {};
			}
			context.system.stats.prompt = {label: game.i18n.localize("PBTA.Prompt")};
			if (Object.keys(context.system.stats).length > 1) {
				context.system.stats.ask = {label: game.i18n.localize("PBTA.Ask")};
			}
			context.system.stats.formula = {label: game.i18n.localize("PBTA.Formula")};
		}

		context.system.moveTypes = game.pbta.sheetConfig?.actorTypes[pbtaSheetType]?.moveTypes ?? {};
		context.system.equipmentTypes = game.pbta.sheetConfig?.actorTypes[pbtaSheetType]?.equipmentTypes ?? null;

		// Add roll example.
		if (itemType === "npcMove") {
			context.system.rollExample = game.pbta.sheetConfig?.rollFormula ?? "2d6";
		}

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

		if (itemType === "move" || itemType === "npcMove") {
			for (let [key, moveResult] of Object.entries(context.system.moveResults)) {
				context.system.moveResults[key].rangeName = `system.moveResults.${key}.value`;
				context.system.moveResults[key].value =
					await TextEditor.enrichHTML(moveResult.value, enrichmentOptions);
			}
		}

		if (context.system?.choices) {
			context.system.choices = await TextEditor.enrichHTML(context.system.choices, enrichmentOptions);
		}

		// Handle preprocessing for tagify data.
		if (itemType === "equipment") {
			// If there are tags, convert it into a string.
			if (context.system.tags !== undefined && context.system.tags !== "") {
				let tagArray = [];
				try {
					tagArray = JSON.parse(context.system.tags);
				} catch(e) {
					tagArray = [context.system.tags];
				}
				context.system.tagsString = tagArray.map((item) => {
					return item.value;
				}).join(", ");
			} else {
				// Otherwise, set tags equal to the string.
				context.system.tags = context.system.tagsString;
			}
		}

		let returnData = {};
		returnData = {
			item: this.object,
			cssClass: isEditable ? "editable" : "locked",
			editable: isEditable,
			system: context.system,
			effects: effects,
			limited: this.object.limited,
			options: this.options,
			owner: isOwner,
			title: context.name
		};

		return returnData;
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
