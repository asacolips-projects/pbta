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

	get advancements() {
		return this.system?.advancements ?? null;
	}

	/**
	 * Returns all active conditions.
	 * @returns {object[]}
	 */
	get conditions() {
		return this.conditionGroups.flatMap((c) => c.conditions);
	}

	/**
	 * Returns all active conditions ordered by group.
	 * @returns {object[]}
	 */
	get conditionGroups() {
		return Object.entries(this.system.attributes)
			.filter((attr) => attr[1]?.condition)
			.map((condition) => {
				return {
					key: condition[0],
					label: condition[1].label,
					conditions: Object.values(condition[1].options)
						.filter((v) => v.value && /(?!\d+-)([+-]*\d+)/.test(v.userLabel ?? v.label))
						.map((v) => {
							const label = v.userLabel || v.label;
							return {
								label,
								mod: Roll.safeEval(label.match(/(?!\d+-)([+-]*\d+)/)[0])
							};
						})
				};
			})
			.filter((c) => c.conditions.length > 0);
	}

	get sheetType() {
		return this.system?.customType ?? null;
	}

	get baseType() {
		return game.pbta.sheetConfig.actorTypes[this.sheetType]?.baseType
			?? (this.type === "other" ? "character" : this.type);
	}

	get playbook() {
		// @todo refactor to return this.items.find((i) => i.type === "playbook"), use slug to compare
		return this.system?.playbook ?? { name: "", slug: "", uuid: "" };
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
			...this.system,
			conditionCount: this.conditions.length,
			conditionGroups: this.conditionGroups
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

	async decrementHold() {
		let hold = this.system?.resources?.hold?.value;
		if (hold) {
			const updates = {};
			updates["system.resources.hold.value"] = --hold;
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
		const itemId = event.currentTarget.closest(".item")?.dataset.itemId;
		const options = {};
		if (!game.settings.get("pbta", "hideRollMode")) {
			options.rollMode = this.flags?.pbta?.rollMode;
		}

		// Handle rolls coming directly from the ability score.
		if (event.currentTarget.classList.contains("stat-rollable")) {
			const stat = event.currentTarget.closest(".stat")?.dataset.stat || null;
			if (stat === "token" && game.pbta.sheetConfig.statToken) await this._onRollToken(stat, label, options);
			else await this._onRollStat(stat, label, options);
		} else if (event.currentTarget.classList.contains("attr-rollable") && roll) {
			await this._onRollAttr(roll, label, options);
		} else if (itemId) {
			const item = this.items.get(itemId);
			const descriptionOnly = event.currentTarget.getAttribute("data-show") === "description";
			item.roll({ ...options, descriptionOnly });
		}
	}

	async _onRollStat(stat, label, options={}) {
		const formula = this._getStatFormula(stat);
		const r = new CONFIG.Dice.RollPbtA(formula, this.getRollData(), foundry.utils.mergeObject(options, {
			rollType: "stat",
			stat
		}));
		const choice = await r.configureDialog({
			title: label ?? game.i18n.format("PBTA.Roll")
		});
		if (choice === null) {
			return;
		}
		await r.toMessage({
			actor: this,
			speaker: ChatMessage.getSpeaker({ actor: this }),
			rollMode: game.settings.get("core", "rollMode")
		});
		if (r.options.conditionsConsumed.includes("forward")) {
			await this.clearForwardAdv();
		}
		if (r.options.conditionsConsumed.includes("hold")) {
			await this.decrementHold();
		}
		await this.updateCombatMoveCount();
	}

	async _onRollToken(stat, label, options={}) {
		const formula = this._getStatFormula();
		const roll = new CONFIG.Dice.RollPbtA(formula, this.getRollData(), foundry.utils.mergeObject(options, { rollType: "stat" }));
		const choice = await roll.configureDialog({
			templateData: {
				isStatToken: true,
				numOfToken: this.system.stats[stat].value
			},
			title: label
		});
		if (choice === true || choice === null) {
			return;
		}
		const tokenUsed = choice.terms.find((t) => t instanceof foundry.dice.terms.NumericTerm)?.number;
		const updates = {
			[`system.stats.${stat}.value`]: this.system.stats[stat].value - tokenUsed
		};
		await roll.toMessage({
			speaker: ChatMessage.getSpeaker({ actor: this }),
			rollMode: game.settings.get("core", "rollMode")
		});
		await this.update(updates);
		if (roll.options.conditionsConsumed.includes("forward")) {
			await this.clearForwardAdv();
		}
		if (roll.options.conditionsConsumed.includes("hold")) {
			await this.decrementHold();
		}
		await this.updateCombatMoveCount();
	}

	_getStatFormula(stat) {
		let formula = this.getRollFormula();
		if (stat) {
			formula += `+ @stats.${stat}.value`;
			if (this.system.stats[stat].toggle) {
				const { modifier } = game.pbta.sheetConfig?.statToggle || {};
				if (!["dis", "adv"].includes(modifier)) {
					formula += `${modifier >= 0 ? "+" : ""} ${modifier}`;
				}
			}
		}
		return formula;
	}

	async _onRollAttr(roll, label, options={}) {
		const r = new CONFIG.Dice.RollPbtA(roll, this.getRollData(), foundry.utils.mergeObject(options, {
			rollType: "flat"
		}));
		const choice = await r.configureDialog({
			actor: this,
			title: label
		});
		if (choice === null) {
			return;
		}
		await r.toMessage({
			speaker: ChatMessage.getSpeaker({ actor: this }),
			rollMode: game.settings.get("core", "rollMode")
		});
	}

	/** @inheritdoc */
	async _preCreate(data, options, user) {
		await super._preCreate(data, options, user);

		const changes = {
			system: this.applyBaseTemplate()
		};
		const compendiumSource = this._stats.compendiumSource;
		if (!compendiumSource?.startsWith("Compendium.")) {
			if (this.baseType === "character") {
				changes.prototypeToken = {
					actorLink: true,
					disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY
				};
			}
		}
		const sheetData = game.pbta.sheetConfig.actorTypes?.[this.type];
		if (sheetData?.moveTypes) {
			const validCreationMoveType = Object.keys(sheetData.moveTypes)
				.filter((mt) => sheetData.moveTypes[mt].creation);
			if (validCreationMoveType.length) {
				changes.items = [];
				let moves = [];
				for (let mt of validCreationMoveType) {
					moves = game.items
						.filter((item) => item.type === "move" && item.system.moveType === mt)
						.map((item) => item.toObject(false));
					const itemCompendiums = game.packs
						.filter((c) => c.metadata?.type === "Item")
						.map((c) => c.metadata.id);
					for (let c of itemCompendiums) {
						const items = (await game.packs.get(c).getDocuments({ type: "move", system: { moveType: mt } }))
							.flatMap((item) => item.toObject(false));
						moves = moves.concat(items);
					}
					if (moves.length) changes.items.push(...moves);
				}
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
		const model = foundry.utils.deepClone(game.model.Actor[sheetType]
			?? game.pbta.sheetConfig.actorTypes[sheetType]);

		// Prepare and return the systemData.
		systemData = foundry.utils.mergeObject(model, systemData);
		delete systemData.templates;
		delete systemData._id;

		return systemData;
	}

	static getLabel(type) {
		const pbtaLabel = game.pbta.sheetConfig.actorTypes[type].label;
		const label = CONFIG[this.metadata.name]?.typeLabels?.[type] ?? type;
		if (pbtaLabel) return pbtaLabel;
		return game.i18n.has(label) ? game.i18n.localize(label) : type;
	}

	static defaultName({ type, parent, pack }={}) {
		const documentName = this.metadata.name;
		let collection;
		if (parent) collection = parent.getEmbeddedCollection(documentName);
		else if (pack) collection = game.packs.get(pack);
		else collection = game.collections.get(documentName);
		const takenNames = new Set();
		for (const document of collection) takenNames.add(document.name);
		const baseName = this.getLabel(type);
		let name = baseName;
		let index = 1;
		while (takenNames.has(name)) name = `${baseName} (${++index})`;
		return name;
	}

	static async createDialog(data={}, { parent=null, pack=null, ...options }={}) {
		const documentName = this.metadata.name;
		const types = Object.keys(game.pbta.sheetConfig.actorTypes);
		let collection;
		if (!parent) {
			if (pack) collection = game.packs.get(pack);
			else collection = game.collections.get(documentName);
		}
		const folders = collection?._formatFolderSelectOptions() ?? [];
		const label = game.i18n.localize(this.metadata.label);
		const title = game.i18n.format("DOCUMENT.Create", { type: label });

		// Render the document creation form
		const html = await renderTemplate("templates/sidebar/document-create.html", {
			folders,
			name: data.name || game.i18n.format("DOCUMENT.New", { type: label }),
			folder: data.folder,
			hasFolders: folders.length >= 1,
			type: data.type || CONFIG[documentName]?.defaultType || types[0],
			types: types.reduce((obj, t) => {
				obj[t] = this.getLabel(t);
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
				foundry.utils.mergeObject(data, fd.object, { inplace: true });
				if (!data.folder) delete data.folder;
				if (types.length === 1) data.type = types[0];
				if (!data.name?.trim()) data.name = this.defaultName({ type: data.type, parent, pack });

				// First we need to find the base actor type to model this after.
				if (!["character", "npc"].includes(data.type)) {
					data.system = {
						customType: data.type
					};
					data.type = "other";
				}

				return this.create(data, { parent, pack, renderSheet: true });
			},
			rejectClose: false,
			options
		});
	}
}
