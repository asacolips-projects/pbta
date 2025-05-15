/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export default class PbtaItemSheet extends ItemSheet {
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

	/**
	 * Returns an object of allowed actors types for this item.
	 * @returns {object}
	 */
	get validCharacterTypes() {
		return Object.fromEntries(
			Object.entries(game.pbta.sheetConfig.actorTypes)
				.filter(([k, v]) => this.item.constructor._filterActorTypes([k, v], this.item.type))
		);
	}

	/* -------------------------------------------- */

	/** @override */
	async getData() {
		const source = this.item.toObject();
		const context = {
			actor: this.actor,
			item: this.item,
			source: source.system,
			system: foundry.utils.duplicate(this.item.system),
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

		// Handle rich text fields.
		const enrichmentOptions = {
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
			context.actorTypes = Object.fromEntries(Object.entries(sheetConfig.actorTypes)
				.filter(([a, v]) => this.item.constructor._filterActorTypes([a, v], this.item.type))
				.map(([a, v]) => {
					const pbtaLabel = game.pbta.sheetConfig.actorTypes[a].label;
					const label = CONFIG.Actor?.typeLabels?.[a] ?? a;
					return [a, { label: pbtaLabel ?? (game.i18n.has(label) ? game.i18n.localize(label) : a) }];
				}));
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
				Object.entries(context.system.stats).forEach(([stat, data]) => {
					data.group = game.i18n.localize("PBTA.Stat.labelPl");
					data.value = stat;
				});
				context.system.stats.prompt = { label: game.i18n.localize("PBTA.Prompt") };
				if (Object.keys(context.system.stats).length > 1) {
					context.system.stats.ask = { label: game.i18n.localize("PBTA.Ask") };
				}
				context.system.stats.formula = { label: game.i18n.localize("PBTA.Formula") };

				if (context.system?.choices) {
					context.enriched.choices = await TextEditor.enrichHTML(context.system.choices, enrichmentOptions);
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
			const whitelist = game.pbta.utils.getTagList(this.item, "item");
			const tagify = this._tagify(html, "system.tags", whitelist, 20);
			tagify.on("edit:start", ({ detail: { tag, data } }) => CONFIG.TagHandler.onEdit(tagify, { tag, data }));
		}
		html.find(".regenerate-slug").on("click", this._onItemRegenerateSlug.bind(this));
	}

	_onItemRegenerateSlug(event) {
		event.preventDefault();
		this.item.update({ "system.slug": this.item.name.slugify() });
	}

	/**
	 * Add tagging widget.
	 * @param {HTMLElement} html	The form containing the tags' input field.
	 * @param {string} inputName	The "name" attribute of the input field.
	 * @param {object[]} whitelist	A list of tags to be available to choose from.
	 * @param {number} maxItems	The number of tags displayed when selecting the input field.
	 * @param {object} config	More Tagify configs, such as additional methods
	 * @returns {Tagify | undefined}
	 */
	_tagify(html, inputName, whitelist, maxItems = 20, config = CONFIG.TagHandler.config) {
		const $input = html.find(`input[name="${inputName}"]`);
		if ($input.length > 0) {
			if (!this.isEditable) {
				$input.attr("readonly", true);
			}

			return new Tagify($input[0], {
				whitelist,
				dropdown: {
					maxItems, // <- mixumum allowed rendered suggestions
					classname: "tags-look", // <- custom classname for this dropdown, so it could be targeted
					enabled: 0,             // <- show suggestions on focus
					closeOnSelect: false    // <- do not hide the suggestions dropdown once an item has been selected
				},
				...config
			});
		}
	}
}
