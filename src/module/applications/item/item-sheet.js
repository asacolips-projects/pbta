/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export default class PbtaItemSheet extends ItemSheet {
	constructor(...args) {
		super(...args);
		if (this.item.type === "playbook") {
			this.options.classes.push("playbook");
		}
	}

	/** @override */
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			classes: ["pbta", "sheet", "item"],
			width: 450,
			height: 450,
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
		const source = this.item.toObject();
		const context = {
			actor: this.actor,
			item: this.item,
			source: source.system,
			system: this.item.system,

			effects: this.item.effects.map((e) => foundry.utils.deepClone(e)),
			owner: this.item.isOwner,
			limited: this.item.limited,
			options: this.options,
			editable: this.isEditable,
			cssClass: this.isEditable ? "editable" : "locked",
			flags: this.item.flags,
			isGM: game.user.isGM
		};

		// Add playbooks.
		context.playbooks = game.pbta.utils.getPlaybookLabels();

		// Handle rich text fields.
		const enrichmentOptions = {
			secrets: this.item.isOwner,
			rollData: this.item?.getRollData() ?? {},
			relativeTo: this.item
		};

		if (context.system?.description) {
			context.system.description = await TextEditor.enrichHTML(context.system.description, enrichmentOptions);
		}

		const sheetConfig = game.pbta.sheetConfig;
		const actorType = this.actor?.type || this.item.system?.actorType;
		if (this.item.system.actorType !== undefined) context.actorTypes = this._getActorTypes();
		if (this.item.type === "move" || this.item.type === "npcMove") {
			if (this.item.type === "move") {
				context.system.stats = {};
				if (this.actor?.system?.stats) {
					context.system.stats = foundry.utils.duplicate(this.actor.system.stats);
				} else {
					const validCharacterType = Object.fromEntries(Object.entries(sheetConfig.actorTypes)
						.filter(([k, v]) => [k, v?.baseType].includes("character") && v.stats));

					if (Object.keys(validCharacterType).length) {
						context.system.stats = foundry.utils.duplicate(validCharacterType[actorType || "character"].stats);
					}
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
				context.system.rollExample = sheetConfig?.rollFormula ?? "2d6";
			}
			context.system.moveTypes = {};
			if (this.actor?.system?.moveTypes) {
				context.system.moveTypes = foundry.utils.duplicate(this.actor?.system?.moveTypes);
			} else {
				const validCharacterType = Object.fromEntries(Object.entries(sheetConfig.actorTypes)
					.filter(([k, v]) => [k, v?.baseType].includes("character") && v.moveTypes));
				if (Object.keys(validCharacterType).length) {
					context.system.moveTypes = foundry.utils.duplicate(validCharacterType[actorType || "character"].moveTypes);
				}
			}
			if (Object.keys(context.system.moveTypes) && context.system.moveType) {
				if (context.system.moveTypes[context.system.moveType].playbook) {
					context.isPlaybookMove = true;
				}
			}

			for (let [key, moveResult] of Object.entries(context.system.moveResults)) {
				context.system.moveResults[key].rangeName = `system.moveResults.${key}.value`;
				context.system.moveResults[key].value =
					await TextEditor.enrichHTML(moveResult.value, enrichmentOptions);
			}
		} else if (this.item.type === "equipment") {
			const actorType = this.actor?.type || this.item.system.actorType;
			context.system.equipmentTypes = sheetConfig?.actorTypes[actorType]?.equipmentTypes ?? null;
		}

		return context;
	}

	_getActorTypes() {
		const sheetConfig = game.pbta.sheetConfig;
		const filters = (a) => {
			switch (this.item.type) {
				case "equipment":
					return sheetConfig.actorTypes[a]?.equipmentTypes;
				case "move":
				case "playbook":
					return a === "character" || sheetConfig.actorTypes[a]?.baseType === "character";
				case "npcMove":
					return a === "npc" || sheetConfig.actorTypes[a]?.baseType === "npc";
				default:
					return false;
			}
		};
		return Object.keys(sheetConfig.actorTypes)
			.filter((a) => filters(a))
			.map((a) => {
				const pbtaLabel = game.pbta.sheetConfig.actorTypes[a].label;
				const label = CONFIG.Actor?.typeLabels?.[a] ?? a;
				return {
					label: pbtaLabel ?? (game.i18n.has(label) ? game.i18n.localize(label) : a),
					value: a
				};
			});
	}

	/* -------------------------------------------- */

	/** @override */
	async activateListeners(html) {
		super.activateListeners(html);
		if (this.item.type === "equipment") {
			this._tagify(html);
		}
		html.find(".regenerate-slug").on("click", this._onItemRegenerateSlug.bind(this));
	}

	_onItemRegenerateSlug(event) {
		event.preventDefault();
		this.item.update({ "system.slug": this.item.name.slugify() });
	}

	/**
	 * Add tagging widget.
	 * @param {HTMLElement} html
	 */
	async _tagify(html) {
		let $input = html.find('input[name="system.tags"]');
		if ($input.length > 0) {
			if (!this.isEditable) {
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
