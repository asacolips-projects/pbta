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
			tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }]
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
			enriched: {
				description: this.item.system.description
			},

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
			async: true,
			secrets: this.item.isOwner,
			rollData: this.item?.getRollData() ?? {},
			relativeTo: this.item
		};

		if (context.system?.description) {
			context.enriched.description = await TextEditor.enrichHTML(context.system.description, enrichmentOptions);
		}

		const sheetConfig = game.pbta.sheetConfig;
		const actorType = this.actor?.system?.customType || this.actor?.baseType || this.item.system?.actorType;
		if (!this.actor && this.item.system.actorType !== undefined) {
			context.actorTypes = this.item.getActorTypes();
		}
		if (this.item.type === "move" || this.item.type === "npcMove") {
			context.system.moveTypes = {};
			if (this.actor?.system?.moveTypes) {
				context.system.moveTypes = foundry.utils.duplicate(this.actor?.system?.moveTypes);
			} else {
				const characterOrNpc = this.item.type === "npcMove" ? "npc" : "character";
				const validCharacterType = Object.fromEntries(Object.entries(sheetConfig.actorTypes)
					.filter(([k, v]) => [k, v?.baseType].includes(characterOrNpc) && v.moveTypes));
				if (Object.keys(validCharacterType).length) {
					const moveTypes = validCharacterType[actorType]?.moveTypes
						?? validCharacterType[characterOrNpc]?.moveTypes;
					context.system.moveTypes = foundry.utils.duplicate(moveTypes);
				}
			}

			if (this.item.system?.moveResults) {
				context.enriched.moveResults = foundry.utils.duplicate(this.item.system.moveResults);
			}
			if (this.item.system?.choices) {
				context.enriched.choices = this.item.system?.choices ?? "";
			}

			for (let [key, moveResult] of Object.entries(context.system.moveResults)) {
				context.system.moveResults[key].rangeName = `system.moveResults.${key}.value`;
				context.enriched.moveResults[key].value =
					await TextEditor.enrichHTML(moveResult.value, enrichmentOptions);
			}

			if (this.item.type === "move") {
				context.system.stats = {};
				if (this.actor?.system?.stats) {
					context.system.stats = foundry.utils.duplicate(this.actor.system.stats);
				} else {
					const validCharacterType = Object.fromEntries(Object.entries(sheetConfig.actorTypes)
						.filter(([k, v]) => [k, v?.baseType].includes("character") && v.stats));

					if (Object.keys(validCharacterType).length) {
						const stats = validCharacterType[actorType]?.stats || validCharacterType.character?.stats;
						context.system.stats = foundry.utils.duplicate(stats);
					}
				}
				context.system.stats.prompt = { label: game.i18n.localize("PBTA.Prompt") };
				if (Object.keys(context.system.stats).length > 1) {
					context.system.stats.ask = { label: game.i18n.localize("PBTA.Ask") };
				}
				context.system.stats.formula = { label: game.i18n.localize("PBTA.Formula") };

				if (context.system?.choices) {
					context.enriched.choices = await TextEditor.enrichHTML(context.system.choices, enrichmentOptions);
				}
				if (Object.keys(context.system.moveTypes) && context.system.moveType) {
					if (context.system.moveTypes[context.system.moveType]?.playbook) {
						context.isPlaybookMove = true;
					}
				}
			} else if (this.item.type === "npcMove") {
				context.system.rollExample = sheetConfig?.rollFormula ?? "2d6";
			}
		} else if (this.item.type === "equipment") {
			const equipmentTypes = sheetConfig?.actorTypes[actorType]?.equipmentTypes
				|| sheetConfig?.actorTypes.character?.equipmentTypes;
			context.system.equipmentTypes = equipmentTypes ?? null;
		}

		return context;
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
	 * Adding a tag template that puts the description, if it exists otherwise 
	 * it uses the value
	 * @param tagData
	 * @returns an HTML template for the tag
	 */
	_tagTemplate(tagData) {
		return `
			<tag data-tooltip="${tagData.description || ""}"
					class="tagify__tag ${tagData.class ? tagData.class : ""}" ${this.getAttributes(tagData)}>
				<x title='' class='tagify__tag__removeBtn' role='button' aria-label='remove tag'></x>
				<div>
					<span class='tagify__tag-text'>${tagData.value}</span>
				</div>
			</tag>
		`;
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
				},
				templates: {
					tag: this._tagTemplate   // <- Add a custom template so descriptions show in a tooltip
				}
			});
		}
	}
}
