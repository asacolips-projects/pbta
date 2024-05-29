export default class ItemPbta extends Item {
	static getDefaultArtwork(itemData) {
		if (itemData.type === "move" || itemData.type === "npcMove") {
			return { img: "icons/svg/aura.svg" };
		} else if (itemData.type === "playbook") {
			return { img: "icons/svg/book.svg" };
		} else if (itemData.type === "tag") {
			return { img: "systems/pbta/assets/icons/svg/tag.svg" };
		}
		return { img: this.DEFAULT_ICON };
	}

	/** @override */
	getRollData() {
		let rollData = {
			...this.system,
			type: this.type
		};
		if (this.actor && this.actor.system?.stats) {
			rollData = foundry.utils.mergeObject(rollData, this.actor.getRollData());
		}
		rollData.formula = this.getFormula();
		return rollData;
	}

	getFormula(defaultFormula = "2d6") {
		if (this.system.rollType === "formula") {
			const rollFormula = this.system.rollFormula;
			if (rollFormula && Roll.validate(rollFormula)) {
				return rollFormula.trim();
			}
		}
		return this.actor?.getRollFormula(defaultFormula) ?? game.pbta.sheetConfig.rollFormula ?? defaultFormula;
	}

	/**
	 * Roll the item to Chat, creating a chat card which contains follow up attack or damage roll options
	 * @param {object} options
	 * @param {boolean} options.descriptionOnly
	 */
	async roll(options = { descriptionOnly: false }) {
		if (options.descriptionOnly || this.type === "equipment" || (this.type !== "npcMove" && !this.system.rollType)) {
			const content = await renderTemplate("systems/pbta/templates/chat/chat-move.html", {
				actor: this.actor,
				tokenId: this.actor?.token?.uuid || null,
				item: this,

				image: this.img,
				title: this.name,
				details: this.system.description,
				tags: this.system.tags
			});
			ChatMessage.create({
				user: game.user.id,
				content: content,
				speaker: ChatMessage.getSpeaker({ actor: this.actor })
			});
		} else {
			delete options.descriptionOnly;
			const formula = this._getRollFormula(options);
			options = foundry.utils.mergeObject(options, {
				choices: this.system.choices,
				details: this.system.description,
				moveResults: this.system.moveResults,
				resources: this.actor?.system.resources
			});
			const r = new CONFIG.Dice.RollPbtA(formula, this.getRollData(), options);
			delete options.stat;
			delete options.rollMode;
			const choice = await r.configureDialog({
				templateData: options,
				title: game.i18n.format("PBTA.RollLabel", { label: this.name })
			});
			if (choice === null) {
				return;
			}
			await r.toMessage({
				actor: this.actor,
				tokenId: this.actor?.token?.uuid || null,
				item: this,

				speaker: ChatMessage.getSpeaker({ actor: this.actor }),
				image: this.img,
				title: this.name,
				rollMode: game.settings.get("core", "rollMode"),
				flags: {
					pbta: {
						itemUuid: this.uuid
					}
				}
			});
			if (r.options.conditionsConsumed.includes("forward")) {
				await this.actor?.clearForwardAdv();
			}
			await this.actor.updateCombatMoveCount();
		}
	}

	_getRollFormula(options = {}) {
		let formula = "@formula";
		const { rollFormula, rollMod, rollType } = this.system;
		options.rollType = rollType;
		if (this.type === "npcMove" || rollType === "formula") {
			formula = rollFormula;
		} else if (!["ask", "prompt", "formula"].includes(rollType)) {
			const { label, value, toggle } = this.actor.system.stats[rollType];
			options.stat = {
				label,
				value
			};
			formula += `+ @stats.${rollType}.value`;
			if (toggle) {
				const { modifier } = game.pbta.sheetConfig.statToggle;
				formula += `${modifier >= 0 ? "+" : ""} ${modifier}`;
				options.stat.value = modifier;
			}
		}
		if (rollMod) {
			formula += " + @rollMod";
		}
		return formula;
	}

	/** @inheritdoc */
	async _preCreate(data, options, userId) {
		await super._preCreate(data, options, userId);

		// Handle Moves because they're dependent on template
		if (this.type === "move" || this.type === "npcMove") {
			const templateData = foundry.utils.duplicate(this);
			if (!templateData.system) {
				templateData.system = {};
			}

			let resultRanges = game.pbta.sheetConfig.rollResults;
			if (!templateData.system.moveResults) {
				templateData.system.moveResults = {};
			}

			for (let [key, value] of Object.entries(resultRanges)) {
				if (!templateData.system.moveResults[key]) {
					templateData.system.moveResults[key] = {
						key: `system.moveResults.${key}.value`,
						label: value.label,
						value: ""
					};
				}
			}
			this.updateSource({
				system: foundry.utils.mergeObject(templateData.system, this.toObject(false).system)
			});
		}
		if (this.actor && this.system.actorType !== undefined) {
			this.updateSource({ "system.actorType": this.actor?.system?.customType ?? this.actor.type });
		}

		const compendiumSource = this._stats.compendiumSource;
		if (this.type === "playbook") {
			if (this.parent) {
				const attributesUpdate = await this.handleAttributes(data);
				const choiceUpdate = await this.handleChoices(data);
				if (Object.keys(choiceUpdate).length > 0) {
					this.updateSource(choiceUpdate);
					const items = [];
					const grantedItems = [];
					for (const set of choiceUpdate["system.choiceSets"]) {
						for (const choice of set.choices) {
							if (choice.granted) {
								const item = fromUuidSync(choice.uuid);
								if (item) {
									items.push(item.toObject());
									grantedItems.push(item.id);
								} else {
									console.warn("Item is missing !LOCALIZEME");
								}
							}
						}
					}
					await ItemPbta.createDocuments(items, {
						keepId: true,
						parent: this.parent,
						renderSheet: null
					});
					this.updateSource({ "flags.pbta": { grantedItems } });
				}

				const changes = foundry.utils.mergeObject({
					"system.playbook": { name: this.name, slug: this.system.slug, uuid: compendiumSource ?? options.originalUuid }
				}, attributesUpdate);
				if (this.system.actorType) {
					const stats = foundry.utils.duplicate(this.parent.system.stats);
					Object.entries(this.system.stats).forEach(([key, data]) => stats[key].value = data.value);
					changes["system.stats"] = stats;
				}
				await this.parent.update(changes);
			} else {
				const actorTypes = foundry.utils.duplicate(
					Object.fromEntries(Object.entries(game.pbta.sheetConfig?.actorTypes)
						.filter(([a, v]) => this._filterActorTypes([a, v])))
				);
				if (Object.keys(actorTypes).length) {
					const actorType = Object.keys(actorTypes)[0];
					const attributes = this._getValidAttributes(this.system.actorType);
					const stats = actorTypes[this.system.actorType || actorType]?.stats;
					this.updateSource({
						"system.attributes": attributes,
						"system.stats": stats
					});
				}
			}
		}

		// Handle everything else if not imported from compendiums
		if (compendiumSource?.startsWith("Compendium.")) return;
		if (this.type === "playbook") {
			if (!this.system.slug) {
				this.updateSource({ "system.slug": this.name.slugify() });
			}
		}
	}

	async handleAttributes(data) {
		if (Object.keys(data.system?.attributes ?? {}).length > 0) {
			const selected = {};
			for (const attribute in data.system.attributes) {
				const { label, choices, custom, max, type, value } = data.system.attributes[attribute];
				const attrOrDetail = type === "Details" ? "details" : "attributes";
				if (choices.length > 1 || custom) {
					if (custom) {
						const choice = { custom, value };
						if (max !== undefined) choice.max = max;
						choices.push(choice);
					}
					if (["Details", "LongText"].includes(type)) {
						for (const choice of choices) {
							choice.enriched = await TextEditor.enrichHTML(choice.value ?? "", {
								async: true,
								secrets: this.isOwner,
								rollData: this?.getRollData() ?? {},
								relativeTo: this
							});
						}
					}
					await Dialog.wait({
						title: `${game.i18n.localize("ATTRIBUTE !LOCALIZEME")}: ${label}`,
						content: await renderTemplate("systems/pbta/templates/dialog/attributes-dialog.hbs", { attribute, choices, type }),
						default: "ok",
						// @todo add some warning about pending grants
						close: () => {
							return false;
						},
						buttons: {
							skip: {
								label: game.i18n.localize("SKIP !LOCALIZEME"),
								icon: '<i class="fas fa-undo"></i>',
								callback: () => {
									// @todo add some warning about pending grants
								}
							},
							ok: {
								label: game.i18n.localize("OK !LOCALIZEME"),
								icon: '<i class="fas fa-check"></i>',
								callback: async (html) => {
									const fd = new FormDataExtended(html.querySelector(".pbta-choice-dialog"));
									const choice = fd.object[attribute];
									let { custom, max, value } = choices[choice];
									if (custom) value = fd.object.custom;
									if (value) selected[`system.${attrOrDetail}.${attribute}.value`] = value;
									if (max) selected[[`system.${attrOrDetail}.${attribute}.max`]] = max;
								}
							}
						}
					}, { jQuery: false });
				} else if (!attribute.custom) {
					let { value, max = null } = data.system.attributes[attribute];
					if (data.system.attributes[attribute].choices.length) {
						const choice = data.system.attributes[attribute].choices[0];
						value = choice.value;
						max = choice.max ?? max;
					}
					if (value) selected[`system.${attrOrDetail}.${attribute}.value`] = value;
					if (max) selected[[`system.${attrOrDetail}.${attribute}.max`]] = max;
				}
			}
			return selected;
		}
	}

	async handleChoices(data) {
		if (data.system?.choiceSets?.length > 0) {
			for (const choiceSet of data.system.choiceSets) {
				const { advancement, choices, desc, granted, repeatable, title } = choiceSet;
				if (advancement > this.parent.advancement || (granted && !repeatable)) continue;
				const validChoices = choices.filter(
					(c) => {
						const item = fromUuidSync(c.uuid);
						return !c.granted
							&& c.advancement <= this.parent.advancements
							&& !this.actor.items.has(item.id);
					}
				);
				if (!validChoices.length) continue;

				await Dialog.wait({
					title: `${game.i18n.localize("CHOICE !LOCALIZEME")}: ${title}`,
					content: await renderTemplate("systems/pbta/templates/dialog/choice-dialog.hbs", { choices: validChoices, desc, parent: this.parent }),
					default: "ok",
					// @todo add some warning about pending grants
					close: () => {
						return false;
					},
					buttons: {
						skip: {
							label: game.i18n.localize("SKIP !LOCALIZEME"),
							icon: '<i class="fas fa-undo"></i>',
							callback: () => {
								// @todo add some warning about pending grants
							}
						},
						ok: {
							label: game.i18n.localize("OK !LOCALIZEME"),
							icon: '<i class="fas fa-check"></i>',
							callback: async (html) => {
								const fd = new FormDataExtended(html.querySelector(".pbta-choice-dialog"));
								validChoices.forEach((i) => {
									if (fd.object[i.uuid]) {
										const index = choices.findIndex((c) => c.uuid === i.uuid);
										choiceSet.choices[index].granted = true;
									}
								});
							}
						}
					}
				}, { jQuery: false });
			}
		}
		return { "system.choiceSets": data.system.choiceSets };
	}

	async _preUpdate(changed, options, user) {
		if (this.type === "playbook") {
			if (Object.keys(changed?.system?.choiceSets ?? {}).length) {
				if (!Array.isArray(changed.system.choiceSets)) {
					changed.system.choiceSets = Object.values(changed.system.choiceSets);
				}
				changed.system.choiceSets.forEach((cs) => {
					if (cs.choices && Object.keys(cs.choices).length) {
						if (Array.isArray(cs.choices)) cs.choices.sort(this._sortItemAdvancement);
						else cs.choices = Object.values(cs.choices).sort(this._sortItemAdvancement);
					}
				});
			}
		}
		await super._preUpdate(changed, options, user);
	}

	_sortItemAdvancement(a, b) {
		if (a.advancement - b.advancement) return a.advancement - b.advancement;
		return a.name.localeCompare(b.name);
	}

	async _preDelete(options, user) {
		if (this.type ==="playbook" && this.parent) {
			const grantedItems = this.getFlag("pbta", "grantedItems") ?? [];

			const type = game.i18n.localize(this.constructor.metadata.label);
			const buttons = {
				yes: {
					icon: '<i class="fas fa-check"></i>',
					label: game.i18n.localize("Yes"),
					callback: async () => {
						if (grantedItems.length) {
							const granted = new Set(
								grantedItems.filter((grant) => this.parent?.items.has(grant))
							);
							await this.parent.deleteEmbeddedDocuments("Item", Array.from(granted));
						}
						await this.parent.update({ "system.playbook": { name: "", slug: "", uuid: "" } });
						return true;
					}
				},
				keepItems: {
					icon: '<i class="fas fa-floppy-disk"></i>',
					label: game.i18n.localize("PBTA.KeepItems"),
					callback: async () => {
						await this.parent.update({ "system.playbook": { name: "", slug: "", uuid: "" } });
						return true;
					}
				},
				no: {
					icon: '<i class="fas fa-times"></i>',
					label: game.i18n.localize("No"),
					callback: () => {
						return false;
					}
				}
			};
			// @todo check if the items are still there, just length isn't enough
			if (!grantedItems.length) {
				buttons.yes.callback();
			} else {
				const confirm = await Dialog.wait({
					title: `${game.i18n.format("DOCUMENT.Delete", { type })}: ${this.name}`,
					content: `<h4>${game.i18n.localize("AreYouSure")}</h4><p>${game.i18n.format("PBTA.Warnings.Playbook.DeleteWarning", { type, num: grantedItems.length })}</p>`,
					focus: true,
					default: "yes",
					close: () => {
						return null;
					},
					buttons
				});
				if (!confirm) return false;
			}
		}
		await super._preDelete(options, user);
	}

	_onCreate(data, options, userId) {
		if (this.type === "playbook" && !this.parent) {
			CONFIG.PBTA.playbooks.push({
				name: this.name,
				slug: this.system.slug,
				uuid: this.uuid,
				actorType: this.system.actorType
			});
			if (this.system.choiceSets.length) {
				this.system.choiceSets.forEach((cs) => {
					if (cs.choices) cs.choices.forEach((c) => c.granted = false);
				});
			}
		}
		super._onCreate(data, options, userId);
	}

	_onUpdate(changed, options, userId) {
		if (this.type === "playbook") {
			const index = CONFIG.PBTA.playbooks.findIndex((p) => p.uuid === this.uuid);
			CONFIG.PBTA.playbooks[index] = {
				name: this.name,
				slug: this.system.slug,
				uuid: this.uuid,
				actorType: this.system.actorType
			};
			if (changed?.system?.slug !== undefined) {
				const attributes = this._getUpdatedAttributes();
				this.updateSource({ "system.attributes": attributes });
			}
		}
		super._onUpdate(changed, options, userId);
	}

	_onDelete(options, userId) {
		if (this.type === "playbook" && !this.parent) {
			CONFIG.PBTA.playbooks = CONFIG.PBTA.playbooks.filter((p) => p.uuid !== this.uuid);
		}
		super._onDelete(options, userId);
	}

	static async createDialog(data={}, { parent=null, pack=null, ...options }={}) {

		// Collect data
		const documentName = this.metadata.name;
		const types = game.documentTypes[documentName].filter((t) => t !== CONST.BASE_DOCUMENT_TYPE && t !== "tag");
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
				const label = CONFIG[documentName]?.typeLabels?.[t] ?? t;
				obj[t] = game.i18n.has(label) ? game.i18n.localize(label) : t;
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
				return this.create(data, { parent, pack, renderSheet: true });
			},
			rejectClose: false,
			options
		});
	}

	/**
	 * Apply listeners to chat messages.
	 * @param {HTML} html  Rendered chat message.
	 */
	static chatListeners(html) {
		html.on("click", ".card-buttons button", this._onChatCardAction.bind(this));
		html.on("click", ".cell__title", this._onChatCardToggleContent.bind(this));
		html.on("click", ".result-label", this._onChatCardResultToggleContent.bind(this));
	}

	static async _onChatCardAction(event) {
		event.preventDefault();
		const button = event.currentTarget;
		button.disabled = true;
		try {
			const card = button.closest(".chat-message");
			const messageId = card.closest(".message").dataset.messageId;
			const message = game.messages.get(messageId);

			if (!message) return;

			const action = button.dataset.action;
			const shift = action === "shiftUp" ? 1 : -1;
			const shiftMap = { 1: "+", "-1": "-" };

			const rolls = message.rolls;
			let oldRoll = rolls.at(0);

			let rollShiftOperatorTerm = oldRoll.terms
				.find((term) => term instanceof foundry.dice.terms.OperatorTerm && term.options.rollShifting);
			let rollShiftNumericTerm = oldRoll.terms
				.find((term) => term instanceof foundry.dice.terms.NumericTerm && term.options.rollShifting);
			let originalValue = `${rollShiftOperatorTerm?.operator ?? ""}${rollShiftNumericTerm?.number ?? ""}`;
			if (Number.isNumeric(originalValue)) originalValue = Number(originalValue);
			if (!rollShiftNumericTerm) {
				oldRoll.terms.push(
					rollShiftOperatorTerm = new foundry.dice.terms.OperatorTerm({
						operator: shiftMap[shift],
						options: { rollShifting: true }
					}),
					rollShiftNumericTerm = new foundry.dice.terms.NumericTerm({
						number: 1,
						options: { rollShifting: true }
					})
				);
			} else {
				rollShiftNumericTerm.number = Math.abs(
					Roll.safeEval(`${rollShiftOperatorTerm.operator}${rollShiftNumericTerm.number} + ${shift}`)
				);
			}

			if (
				rollShiftNumericTerm.number === 1
				&& originalValue === 0
				&& rollShiftOperatorTerm.operator !== shiftMap[shift]
			) {
				rollShiftOperatorTerm.operator = shiftMap[shift];
			} else if (rollShiftNumericTerm.number === 0) {
				rollShiftOperatorTerm.operator = "+";
			}

			oldRoll.resetFormula();
			oldRoll = await oldRoll._evaluate();

			await message.update({ rolls });
		} catch(err) {
			console.error("Error handling chat card action:", err);
		} finally {
			button.disabled = false;
		}
	}

	static _onChatCardToggleContent(event) {
		event.preventDefault();
		const header = event.currentTarget;
		const card = header.closest(".cell");
		const content = card.querySelector(".card-content");
		content.style.display = content.style.display === "none" ? "" : "none";
	}

	static _onChatCardResultToggleContent(event) {
		event.preventDefault();
		const header = event.currentTarget;
		const card = header.closest(".row");
		const content = card.querySelector(".result-details");
		const choices = card.querySelector(".result-choices");
		if (content) {
			content.style.display = content.style.display === "none" ? "" : "none";
		}
		if (choices) {
			choices.style.display = choices.style.display === "none" ? "" : "none";
		}
	}

	/* -------------------------------------------- */

	static VALID_ATTRIBUTES = ["Number", "Resource", "Text", "LongText"];

	_filterAttributes(attributes) {
		return Object.fromEntries(
			Object.entries(attributes)
				.filter(([key, data]) => {
					const isValidType = !data.type || ItemPbta.VALID_ATTRIBUTES.includes(data.type);
					const hasPlaybook = data.playbook === true || data.playbook === this.system.slug;
					return isValidType && hasPlaybook;
				})
				.map(([key, data]) => {
					data.type ??= "Details";
					if (data.type === "Resource") {
						data.choices = [{ value: data.value, max: data.max }];
					} else if (data.value) {
						data.choices = [{ value: data.value }];
					} else data.choices = [];
					data.custom = false;
					return [key, data];
				})
		);
	}

	_getValidAttributes(actorType, actorTypes) {
		actorTypes ??= foundry.utils.duplicate(
			Object.fromEntries(Object.entries(game.pbta.sheetConfig?.actorTypes)
				.filter(([a, v]) => this._filterActorTypes([a, v])))
		);
		if (Object.keys(actorTypes).length) {
			actorType ||= Object.keys(actorTypes)[0];
			return {
				...this._filterAttributes(actorTypes[actorType]?.attrTop ?? {}),
				...this._filterAttributes(actorTypes[actorType]?.attrLeft ?? {}),
				...this._filterAttributes(actorTypes[actorType]?.details ?? {})
			};
		}
	}

	_getUpdatedAttributes() {
		const attributes = foundry.utils.duplicate(this.system.attributes);
		const validAttributes = this._getValidAttributes(this.system.actorType);
		if (Object.keys(validAttributes).length > Object.keys(attributes).length) {
			Object.entries(validAttributes).forEach(([key, data]) => {
				if (!attributes[key]) attributes[key] = data;
			});
		} else if (Object.keys(validAttributes).length < Object.keys(attributes).length) {
			Object.keys(attributes).forEach((key) => {
				if (!validAttributes[key]) {
					delete attributes[key];
					attributes[`-=${key}`] = null;
				}
			});
		}
		return attributes;
	}

	_filterActorTypes([key, data], type) {
		type ??= this.type;
		switch (type) {
			case "equipment":
				return data?.equipmentTypes;
			case "move":
			case "playbook":
				return [key, data?.baseType].includes("character");
			case "npcMove":
				return [key, data?.baseType].includes("npc");
			default:
				return false;
		}
	}
}
