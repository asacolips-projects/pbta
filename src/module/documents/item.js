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
		rollData.formula = this.getRollFormula();
		return rollData;
	}

	getRollFormula(defaultFormula = "2d6") {
		if (this.system.rollType === "formula") {
			const rollFormula = this.system.rollFormula;
			if (rollFormula && Roll.validate(rollFormula)) {
				return rollFormula.trim();
			}
		}
		return this.actor?.getRollFormula(defaultFormula) ?? game.pbta.sheetConfig.rollFormula ?? defaultFormula;
	}

	/**
	 * Returns a list of valid actor types for the item.
	 * @returns {object}
	 */
	getActorTypes() {
		const sheetConfig = game.pbta.sheetConfig;
		const filters = (a) => {
			switch (this.type) {
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
		return Object.fromEntries(Object.entries(sheetConfig.actorTypes)
			.filter(([a, v]) => filters(a))
			.map(([a, v]) => {
				const pbtaLabel = game.pbta.sheetConfig.actorTypes[a].label;
				const label = CONFIG.Actor?.typeLabels?.[a] ?? a;
				return [a, { label: pbtaLabel ?? (game.i18n.has(label) ? game.i18n.localize(label) : a) }];
			}));
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
			let formula = "@formula";
			let stat = "";
			let { rollFormula, rollMod, rollType = "move" } = this.system;
			if (this.type === "npcMove" || rollType === "formula") {
				formula = rollFormula;
			} else if (!["ask", "prompt", "formula"].includes(rollType)) {
				stat = rollType;
				formula += `+ @stats.${stat}.value`;
				if (this.actor.system.stats[stat].toggle) {
					const { modifier } = game.pbta.sheetConfig.statToggle;
					formula += `${modifier >= 0 ? "+" : ""} ${modifier}`;
				}
			}
			if (rollMod) {
				formula += " + @rollMod";
			}
			const r = new CONFIG.Dice.RollPbtA(formula, this.getRollData(), foundry.utils.mergeObject(options, {
				rollType: this.type,
				sheetType: this.actor?.baseType,
				stat
			}));
			const choice = await r.configureDialog({
				templateData: {
					title: this.name,
					details: this.system.description,
					moveResults: this.system.moveResults,
					choices: this.system?.choices,
					sheetType: this.actor?.baseType,
					rollType
				},
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
			await this.actor?.clearForwardAdv();
			await this.actor.updateCombatMoveCount();
		}
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
			const actorTypes = this.getActorTypes();
			if (Object.keys(actorTypes).length) {
				const actorType = Object.keys(actorTypes)[0];
				const stats = game.pbta.sheetConfig?.actorTypes[actorType]?.stats;
				this.updateSource({ "system.stats": stats });
			}

			if (this.parent) {
				const choiceUpdate = await this.handleChoices(data);
				if (Object.keys(choiceUpdate).length > 0) {
					this.updateSource(choiceUpdate);
					const items = await Promise.all(
						choiceUpdate["system.choiceSets"].flatMap(
							(set) => set.choices.filter((i) => i.granted)
								.map((i) => fromUuid(i.uuid))
						)
					);
					const grantedItems = await ItemPbta.createDocuments(
						items.map((i) => i.toObject()),
						{
							parent: this.parent,
							renderSheet: null
						}
					);
					const created = grantedItems.map((i) => i.id);
					this.updateSource({ "flags.pbta": { grantedItems: created } });
				}
				await this.parent.update({
					"system.playbook": { name: this.name, slug: this.system.slug, uuid: compendiumSource ?? options.originalUuid }
				});
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

	async handleChoices(data) {
		if (data.system?.choiceSets?.length > 0) {
			for (const choiceSet of data.system.choiceSets) {
				const { advancement, choices, desc, granted, repeatable, title } = choiceSet;
				if (advancement > this.parent.advancement || (granted && !repeatable)) continue;
				const validChoices = choices.filter((c) => !c.granted && c.advancement <= this.parent.advancements);
				if (!validChoices.length) continue;

				await Dialog.wait({
					title: `${game.i18n.localize("CHOICE !LOCALIZEME")}: ${title}`,
					content: await renderTemplate("systems/pbta/templates/dialog/choice-dialog.hbs", { choices: validChoices, desc, parent: this.parent }),
					default: "ok",
					// @todo add some warning about pending grants
					// close: () => {},
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
			if (changed.system?.choiceSets) {
				changed.system.choiceSets.forEach((cs) => {
					if (cs.choices) cs.choices.sort(this._sortItemAdvancement);
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
			let content = foundry.utils.duplicate(message.content);
			let rolls = foundry.utils.deepClone(message.rolls);

			const plusMinusReg = /([+-]\s*\d)/;
			const diceFormulaReg = /<div class="dice-formula">(.*)<\/div>/;
			const diceTotalReg = /<h4 class="dice-total">(.*)<\/h4>/;

			if (diceFormulaReg.test(content)) {
				const diceFormula = content.match(diceFormulaReg);
				let roll = diceFormula[1];
				const plusMinusMatch = roll.match(plusMinusReg);
				const value = plusMinusMatch ? plusMinusMatch[1] : "";
				const shift = action === "shiftUp" ? 1 : -1;
				const newValue = Roll.safeEval(`${value} + ${shift}`);
				const updatedValue = newValue >= 0 ? `+ ${newValue}` : `- ${Math.abs(newValue)}`;

				roll = plusMinusMatch ? roll.replace(plusMinusReg, updatedValue) : `${roll} ${updatedValue}`;
				content = content.replace(diceFormula[1], roll);

				const diceTotal = content.match(diceTotalReg);
				let total = Roll.safeEval(`${diceTotal[1]} + ${shift}`);
				content = content.replace(diceTotalReg, `<h4 class="dice-total">${total}</h4>`);

				const { rollResults } = game.pbta.sheetConfig;
				const { resultType, rollType } = message.rolls[0].options;
				const { start, end } = rollResults?.[resultType] ?? {};

				if ((action === "shiftUp" && end && end < total) || (action === "shiftDown" && start && start > total)) {
					const newResult = Object.keys(rollResults)
						.filter((k) => k !== resultType)
						.find((k) => {
							const { start, end } = rollResults[k];
							return (!start || total >= start) && (!end || total <= end);
						});

					rolls[0].options.resultType = newResult;

					if (rollType === "move" || rollType === "npcMove") {
						const itemUuid = message.getFlag("pbta", "itemUuid");
						const item = await fromUuid(itemUuid);
						if (item && item.system.moveResults) {
							const moveResult = item.system.moveResults[newResult];
							content = content.replace(/<div class="row result (.*?)">/, `<div class="row result ${newResult}">`);
							content = content.replace(/<div class="roll (.*?)">/, `<div class="roll ${newResult}">`);
							content = content.replace(/<div class="result-label">(.*?)<\/div>/, `<div class="result-label">${moveResult.label}</div>`);
							content = content.replace(/<div class="result-details">[\s\S]*?<\/div>/, `<div class="result-details">${moveResult.value}</div>`);
						}
					}
				}

				await message.update({ content, rolls });
			}
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
}
