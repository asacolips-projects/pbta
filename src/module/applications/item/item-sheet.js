/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export default class PbtaItemSheet extends ItemSheet {
	constructor(...args) {
		super(...args);
		if (this.item.type === "equipment") {
			if (this.actor) {
				this.options.height = this.position.height = 600;
			} else {
				this.options.height = this.position.height = 555;
			}
		} else if (this.item.type === "playbook") {
			this.options.classes.push("class");
			this.options.width = this.position.width = 780;
			this.options.tabs[0].initial = "description";
		}
	}

	/** @override */
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
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
		context.system.playbooks = await game.pbta.utils.getPlaybooks();

		// Handle rich text fields.
		const enrichmentOptions = {
			rollData: this.item?.getRollData() ?? {},
			relativeTo: this.actor
		};

		if (context.system?.description) {
			context.system.description = await TextEditor.enrichHTML(context.system.description, enrichmentOptions);
		}

		if (this.item.type === "move" || this.item.type === "npcMove") {
			if (this.item.type === "move") {
				if (game.pbta.sheetConfig?.actorTypes[actor?.baseType]?.stats) {
					const stats = foundry.utils.duplicate(game.pbta.sheetConfig.actorTypes[actor.baseType].stats);
					context.system.stats = stats;
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
		if (this.item.type === "equipment") {
			this._tagify(html);
		}
	}

	/**
	 * Add tagging widget.
	 * @param {HTMLElement} html
	 */
	async _tagify(html) {
		let $input = html.find('input[name="system.tags"]');
		if ($input.length > 0) {
			if (!this.options.editable) {
				$input.attr("readonly", true);
			}
			const whitelist = game.pbta.utils.getTagList(this.item, "item");

			// init Tagify script on the above inputs
			new Tagify($input[0], {
				whitelist,
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
