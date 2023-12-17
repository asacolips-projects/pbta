/**
 * Extends the basic Actor class for Powered by the Apocalypse.
 * @extends {Actor}
 */
export default class ActorPbta extends Actor {
	/**
	 * Augment the basic actor data with additional dynamic data.
	 */
	prepareData() {
		super.prepareData();
		// Handle actor types.
		if (this.baseType === "character") {
			this._prepareCharacterData();
		}
	}

	get sheetType() {
		return this.system?.customType ?? null;
	}

	get baseType() {
		return game.pbta.sheetConfig.actorTypes[this.sheetType]?.baseType
			?? (this.type === "other" ? "character" : this.type);
	}

	get playbook() {
		return this.system?.playbook?.name ?? "";
	}

	/**
	 * Prepare Character type specific data
	 */
	_prepareCharacterData() {
		// Handle special attributes.
		let groups = [
			"attrTop",
			"attrLeft"
		];
		for (let group of groups) {
			for (let attrValue of Object.values(this.system[group])) {
				// ListMany field handling.
				if (["ListOne", "ListMany"].includes(attrValue.type) && attrValue.options) {
					// Iterate over options.
					for (let optV of Object.values(attrValue.options)) {
						// If there's a multi-value field, we need to propagate its value up
						// to the parent `value` property.
						if (optV.values) {
							const optArray = Object.values(optV.values);
							optV.value = optArray.some((subOpt) => subOpt.value);
						}
					}
				}
			}
		}
	}

	/** @override */
	getRollData() {
		return {
			...super.getRollData(),
			formula: this.getRollFormula()
		};
	}

	getRollFormula(defaultFormula = "2d6") {
		const rollFormula = this.system?.resources?.rollFormula;
		if (rollFormula && Roll.validate(rollFormula)) {
			return rollFormula.trim();
		}
		return game.pbta.sheetConfig.rollFormula ?? defaultFormula;
	}

	async clearForwardAdv() {
		const forwardUsed = this.system?.resources?.forward?.value;
		const rollModeUsed = this.getFlag("pbta", "rollMode") !== "def";
		if (forwardUsed || rollModeUsed) {
			const updates = {};
			if (forwardUsed) {
				updates["system.resources.forward.value"] = 0;
			}
			if (rollModeUsed && game.settings.get("pbta", "advForward")) {
				updates["flags.pbta.rollMode"] = "def";
			}
			await this.update(updates);
		}
	}

	async updateCombatMoveCount() {
		if (game.combat && game.combat.combatants) {
			let combatant = game.combat.combatants.find((c) => c.actor.id === this.id);
			if (combatant) {
				let moveCount = combatant.getFlag("pbta", "moveCount") ?? 0;
				moveCount = moveCount ? Number(moveCount) + 1 : 1;
				let combatantUpdate = {
					_id: combatant.id,
					"flags.pbta.moveCount": moveCount
				};
				// Emit a socket for the GM client.
				if (!game.user.isGM) {
					game.socket.emit("system.pbta", {
						combatantUpdate: combatantUpdate
					});
				} else {
					let combatantUpdates = [];
					combatantUpdates.push(combatantUpdate);
					await game.combat.updateEmbeddedDocuments("Combatant", combatantUpdates);
					ui.combat.render();
				}
			}
		}
	}

	/**
	 * Listen for click events on rollables.
	 * @param {MouseEvent} event
	 */
	async _onRoll(event) {
		const { label, roll } = event.currentTarget.dataset;
		const a = event.currentTarget;
		const itemId = $(a).parents(".item")
			.attr("data-item-id");
		const options = {
			rollMode: this.flags?.pbta?.rollMode
		};

		// Handle rolls coming directly from the ability score.
		if ($(a).hasClass("stat-rollable")) {
			let formula = "@formula";
			const stat = $(a).parents(".stat")
				.data("stat") ?? null;
			if (stat) {
				formula += `+ @stats.${stat}.value`;
				if (this.system.stats[stat].toggle) {
					const { modifier } = game.pbta.sheetConfig.statToggle;
					formula += `${modifier >= 0 ? "+" : ""} ${modifier}`;
				}
			}

			const roll = new CONFIG.Dice.RollPbtA(formula, this.getRollData(), foundry.utils.mergeObject(options, {
				rollType: "stat",
				sheetType: this.baseType,
				stat
			}));
			const choice = await roll.configureDialog({
				title: game.i18n.format("PBTA.RollLabel", { label }),
			});
			if (choice === null) {
				return;
			}
			await roll.toMessage({
				speaker: ChatMessage.getSpeaker({actor: this}),
				title: label ?? "",
				rollMode: game.settings.get("core", "rollMode"),
			});
			await this.clearForwardAdv();
			await this.updateCombatMoveCount();
		} else if ($(a).hasClass("attr-rollable") && roll) {
			const r = new CONFIG.Dice.RollPbtA(roll, this.getRollData(), foundry.utils.mergeObject(options, {
				rollType: "flat"
			}));
			const choice = await r.configureDialog({
				title: label,
			});
			if (choice === null) {
				return;
			}
			await r.toMessage({
				speaker: ChatMessage.getSpeaker({actor: this}),
				rollMode: game.settings.get("core", "rollMode"),
			});
		} else if (itemId) {
			const item = this.items.get(itemId);
			const descriptionOnly = a.getAttribute("data-show") === "description";
			item.roll({ descriptionOnly }, options);
		}
	}

	/** @inheritdoc */
	async _preCreate(data, options, user) {
		await super._preCreate(data, options, user);

		const changes = {
			system: this.applyBaseTemplate()
		};
		const sourceId = this.getFlag("core", "sourceId");
		if (!sourceId?.startsWith("Compendium.")) {
			if (this.baseType === "character") {
				changes.prototypeToken = {
					actorLink: true,
					disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
				};
			}
		}
		this.updateSource(changes);
	}

	/**
	 * Applies the actor's model to its data, such as
	 * the Sheet Config's Stats and Attributes.
	 * @returns {object}
	 */
	applyBaseTemplate() {
		let systemData = foundry.utils.deepClone(this.toObject(false).system);

		// Determine the actor type.
		let sheetType = this.type;
		if (this.type === "other") {
			sheetType = systemData?.customType ?? "character";
		}

		// Merge it with the model for that for that actor type to include missing attributes.
		const model = foundry.utils.deepClone(game.system.model.Actor[sheetType]
			?? game.pbta.sheetConfig.actorTypes[sheetType]);

		// Prepare and return the systemData.
		systemData = foundry.utils.mergeObject(model, systemData);
		delete systemData.templates;
		delete systemData._id;

		return systemData;
	}

	static async createDialog(data={}, {parent=null, pack=null, ...options}={}) {
		const documentName = this.metadata.name;
		const types = Object.keys(game.pbta.sheetConfig.actorTypes);
		let collection;
		if (!parent) {
			if (pack) {
				collection = game.packs.get(pack);
			} else {
				collection = game.collections.get(documentName);
			}
		}
		const folders = collection?._formatFolderSelectOptions() ?? [];
		const label = game.i18n.localize(this.metadata.label);
		const title = game.i18n.format("DOCUMENT.Create", {type: label});
		// Render the document creation form
		const html = await renderTemplate("templates/sidebar/document-create.html", {
			folders,
			name: data.name || game.i18n.format("DOCUMENT.New", {type: label}),
			folder: data.folder,
			hasFolders: folders.length >= 1,
			type: data.type || CONFIG[documentName]?.defaultType || types[0],
			types: types.reduce((obj, t) => {
				const pbtaLabel = game.pbta.sheetConfig.actorTypes[t].label;
				const label = CONFIG[documentName]?.typeLabels?.[t] ?? t;
				if (pbtaLabel) {
					obj[t] = pbtaLabel;
				} else {
					obj[t] = game.i18n.has(label) ? game.i18n.localize(label) : t;
				}
				return obj;
			}, {}),
			hasTypes: types.length > 1
		});

		// Render the confirmation dialog window
		return Dialog.prompt({
			title: title,
			content: html,
			label: title,
			callback: (html) => {
				const form = html[0].querySelector("form");
				const fd = new FormDataExtended(form);
				foundry.utils.mergeObject(data, fd.object, {inplace: true});
				if (!data.folder) {
					delete data.folder;
				}
				if (types.length === 1) {
					data.type = types[0];
				}
				if (!data.name?.trim()) {
					data.name = this.defaultName();
				}

				// First we need to find the base actor type to model this after.
				if (!["character", "npc"].includes(data.type)) {
					data.system = {
						customType: data.type
					};
					data.type = "other";
				}

				return this.create(data, {parent, pack, renderSheet: true});
			},
			rejectClose: false,
			options
		});
	}
}
