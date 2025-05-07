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
		const rollData = {
			...foundry.utils.duplicate(this.system),
			type: this.type
		};
		if (this.actor && this.actor.system?.stats) {
			foundry.utils.mergeObject(rollData, this.actor.getRollData());
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
	 */
	async roll(options = {}) {
		if (
			options.descriptionOnly
			|| this.type === "equipment"
			|| (this.type !== "npcMove" && !this.system.rollType)
		) {
			const content = await foundry.applications.handlebars.renderTemplate("systems/pbta/templates/chat/chat-move.html", {
				actor: this.actor,
				tokenId: this.actor?.token?.uuid || null,
				item: this,

				image: this.img,
				title: this.name,
				details: this.system.description,
				tags: this.system.tags,
				noRoll: true
			});
			ChatMessage.create({
				user: game.user.id,
				content: content,
				speaker: ChatMessage.getSpeaker({ actor: this.actor })
			});
		} else {
			const formula = this._getRollFormula(options);
			options = foundry.utils.mergeObject(options, {
				choices: this.system.choices,
				details: this.system.description,
				moveResults: this.system.moveResults,
				resources: this.actor?.system.resources,
				system: this.system
			});
			const r = new CONFIG.Dice.RollPbtA(formula, this.getRollData(), options);
			const choice = await r.configureDialog({
				templateData: options,
				title: this.name
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
				rollMode: game.settings.get("core", "rollMode"),
				flags: {
					pbta: {
						itemUuid: this.uuid
					}
				}
			});
			const updates = {};
			await this.actor?.clearAdv(updates);
			await this.actor?.clearForward(updates, r);
			await this.actor?.decrementHold(updates, r);
			if (Object.keys(updates).length) await this.actor?.update(updates);
			await this.actor?.updateCombatMoveCount();
		}
	}

	_getRollFormula(options = {}) {
		let formula = this.parent.getRollFormula();
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
				const { modifier } = game.pbta.sheetConfig?.statToggle || {};
				if (!["dis", "adv"].includes(modifier)) {
					formula += `${modifier >= 0 ? "+" : ""} ${modifier}`;
					options.stat.value = modifier;
				}
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
		const actorTypes = foundry.utils.duplicate(
			Object.fromEntries(Object.entries(game.pbta.sheetConfig?.actorTypes ?? {})
				.filter(([a, v]) => this.constructor._filterActorTypes([a, v], this.type)))
		);
		const actorType = Object.keys(actorTypes)[0];
		if (this.type === "playbook") {
			if (this.parent) {
				const changes = {
					"system.playbook": { name: this.name, slug: this.system.slug, uuid: compendiumSource ?? options.originalUuid }
				};
				if (!game.pbta.sheetConfig.skipAttributeGrant) {
					const attributesUpdate = await this.handleAttributes(data);
					foundry.utils.mergeObject(changes, attributesUpdate);
				}
				const choiceUpdate = await this.handleChoices(data);
				if (Object.keys(choiceUpdate).length > 0) {
					this.updateSource(choiceUpdate);
					const grantedItems = await this.grantChoices(choiceUpdate);
					this.updateSource({ "flags.pbta": { grantedItems } });
				}
				if (this.system.actorType) {
					const stats = foundry.utils.duplicate(this.parent.system.stats);
					Object.entries(this.system.stats)
						.filter(([key, data]) => key in stats)
						.forEach(([key, data]) => stats[key].value = data.value);
					changes["system.stats"] = stats;
				}
				await this.parent.update(changes);
			} else if (actorType && !this.system.actorType) {
				const attributes = this._getValidAttributes(actorType, actorTypes);
				const stats = actorTypes[actorType]?.stats;
				this.updateSource({
					"system.actorType": actorType,
					"system.attributes": attributes,
					"system.stats": stats
				});
			}
		} else if (actorType && this.system.actorType === "") {
			this.updateSource({ "system.actorType": actorType });
		}

		// Handle everything else if not imported from compendiums
		if (compendiumSource?.startsWith("Compendium.")) return;
		if (this.type === "playbook") {
			if (!this.system.slug) {
				this.updateSource({ "system.slug": this.name.slugify() });
			}
		}
	}

	async grantChoices(choices) {
		const items = [];
		const grantedItems = foundry.utils.getProperty(this, "flags.pbta.grantedItems") ?? [];
		for (const set of choices["system.choiceSets"]) {
			const newChoices = set.choices
				.filter((choice) => choice.granted && !grantedItems.some((id) => choice.uuid.includes(id)));

			for (const choice of newChoices) {
				const item = await fromUuid(choice.uuid);
				if (item) {
					items.push(item.toObject());
					grantedItems.push(item.id);
				} else {
					console.warn("PBTA.Warnings.Playbook.ItemMissing", { localize: true });
				}
			}
		}
		if (items.length) {
			await ItemPbta.createDocuments(items, {
				keepId: true,
				parent: this.parent,
				pack: this.actor.pack
			});
		}
		return grantedItems;
	}

	async handleAttributes(data) {
		if (Object.keys(data.system?.attributes ?? {}).length > 0) {
			const selected = {};
			for (const attribute in data.system.attributes) {
				const {
					label,
					choices,
					custom,
					description,
					max,
					path,
					type,
					value
				} = data.system.attributes[attribute];
				if (choices.length > 1 || custom) {
					if (custom) {
						const choice = { custom, value };
						if (max !== undefined) choice.max = max;
						choices.push(choice);
					}
					if (["Details", "LongText"].includes(type)) {
						for (const choice of choices) {
							choice.enriched = await foundry.applications.ux.TextEditor.implementation.enrichHTML(choice.value ?? "", {
								secrets: this.isOwner,
								rollData: this?.getRollData() ?? {},
								relativeTo: this
							});
						}
					}
					await Dialog.wait({
						title: `${game.i18n.localize("PBTA.Attribute")}: ${label}`,
						content: await foundry.applications.handlebars.renderTemplate("systems/pbta/templates/dialog/attributes-dialog.hbs", {
							attribute,
							choices,
							description,
							type
						}),
						default: "ok",
						// @todo add some warning about pending grants
						close: () => {
							return false;
						},
						buttons: {
							skip: {
								label: game.i18n.localize("Cancel"),
								icon: '<i class="fas fa-undo"></i>',
								callback: () => {
									// @todo add some warning about pending grants
								}
							},
							ok: {
								label: game.i18n.localize("Confirm"),
								icon: '<i class="fas fa-check"></i>',
								callback: async (html) => {
									const fd = new FormDataExtended(html.querySelector(".pbta-attribute-dialog"));
									const choice = fd.object[attribute];
									let { custom, max, options, value } = choices[choice];
									if (custom) value = fd.object.custom;
									if (description) selected[`system.${path}.${attribute}.description`] = description;
									if (value) selected[`system.${path}.${attribute}.value`] = value;
									if (max) selected[[`system.${path}.${attribute}.max`]] = max;
									if (options) selected[`system.${path}.${attribute}.options`] = options;
								}
							}
						}
					}, { jQuery: false });
				} else if (!custom) {
					let { choices, max, options, value } = data.system.attributes[attribute];
					if (choices.length) {
						const choice = choices[0];
						value = choice.value;
						max = choice.max ?? max;
						options = choice.options ?? options;
					}
					if (description) selected[`system.${path}.${attribute}.description`] = description;
					if (value) selected[`system.${path}.${attribute}.value`] = value;
					if (max) selected[[`system.${path}.${attribute}.max`]] = max;
					if (options) selected[[`system.${path}.${attribute}.options`]] = options;
				}
			}
			return selected;
		}
	}

	async handleChoices(data) {
		if (data.system?.choiceSets?.length > 0) {
			for (const choiceSet of data.system.choiceSets) {
				const { advancement, choices, desc, granted, repeatable, title } = choiceSet;
				if (advancement > this.parent.advancements || (granted && !repeatable)) continue;
				const validChoices = (await Promise.all(
					choices.map(async (c) => {
						const item = await fromUuid(c.uuid);
						c.name = item.name;
						c.tags = item.system.tags;
						c.desc = await foundry.applications.ux.TextEditor.implementation.enrichHTML(item.system.description, {
							secrets: this.actor.isOwner,
							rollData: this.actor.getRollData(),
							relativeTo: this.actor
						});
						const isValid = !c.granted
							&& c.advancement <= this.parent.advancements
							&& !this.actor.items.has(item.id);
						return isValid ? c : null;
					}))
				).filter((c) => c);
				if (!validChoices.length) continue;
				choiceSet.granted = true;
				if (choiceSet.grantOn === 0) {
					validChoices.forEach((i) => {
						const index = choices.findIndex((c) => c.uuid === i.uuid);
						choiceSet.choices[index].granted = true;
					});
					continue;
				}

				await Dialog.wait({
					title: `${game.i18n.localize("PBTA.Choice")}: ${title}`,
					content: await foundry.applications.handlebars.renderTemplate("systems/pbta/templates/dialog/choice-dialog.hbs", { choices: validChoices, desc, parent: this.parent }),
					default: "ok",
					// @todo add some warning about pending grants
					close: () => {
						return false;
					},
					buttons: {
						skip: {
							label: game.i18n.localize("Cancel"),
							icon: '<i class="fas fa-undo"></i>',
							callback: () => {
								// @todo add some warning about pending grants
							}
						},
						ok: {
							label: game.i18n.localize("Confirm"),
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
					},
					render: (html) => {
						for (const el of html.querySelectorAll(".item-name")) {
							el.addEventListener("click", (event) => {
								event.preventDefault();
								const toggler = $(event.currentTarget);
								const item = toggler.parents(".item");
								const description = item.find(".item-description");

								toggler.toggleClass("open");
								if (description.hasClass("expanded")) description.slideUp(200);
								else description.slideDown(200);
								description.toggleClass("expanded");
							});
						}
					}
				}, { height: 400, jQuery: false });
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
					label: game.i18n.localize("Confirm"),
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
					label: game.i18n.localize("Cancel"),
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

	static async createDialog(data={}, createOptions={}, { folders, types, template, context, ...dialogOptions }={}) {
		const applicationOptions = {
			top: "position", left: "position", width: "position", height: "position", scale: "position", zIndex: "position",
			title: "window", id: "", classes: "", jQuery: ""
		};

		for (const [k, v] of Object.entries(createOptions)) {
			if (k in applicationOptions) {
				foundry.utils.logCompatibilityWarning("The ClientDocument.createDialog signature has changed. "
					+ "It now accepts database operation options in its second parameter, "
					+ "and options for DialogV2.prompt in its third parameter.", { since: 13, until: 15, once: true });
				const dialogOption = applicationOptions[k];
				if (dialogOption) foundry.utils.setProperty(dialogOptions, `${dialogOption}.${k}`, v);
				else dialogOptions[k] = v;
				delete createOptions[k];
			}
		}

		const { parent, pack } = createOptions;
		const cls = this.implementation;

		// Identify allowed types
		const documentTypes = [];
		let defaultType = CONFIG[this.documentName]?.defaultType;
		let defaultTypeAllowed = false;
		let hasTypes = false;
		if (this.TYPES.length > 1) {
			if (types?.length === 0) throw new Error("The array of sub-types to restrict to must not be empty");

			// Register supported types
			for (const type of this.TYPES) {
				if (type === "base") continue;
				if (type === "tag") continue;
				if (types && !types.includes(type)) continue;
				let label = CONFIG[this.documentName]?.typeLabels?.[type];
				label = label && game.i18n.has(label) ? game.i18n.localize(label) : type;
				documentTypes.push({ value: type, label });
				if (type === defaultType) defaultTypeAllowed = true;
			}
			if (!documentTypes.length) throw new Error("No document types were permitted to be created");

			if (!defaultTypeAllowed) defaultType = documentTypes[0].value;
			// Sort alphabetically
			documentTypes.sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang));
			hasTypes = true;
		}

		// Identify destination collection
		let collection;
		if (!parent) {
			if (pack) collection = game.packs.get(pack);
			else collection = game.collections.get(this.documentName);
		}

		// Collect data
		folders ??= collection?._formatFolderSelectOptions() ?? [];
		const label = game.i18n.localize(this.metadata.label);
		const title = game.i18n.format("DOCUMENT.Create", { type: label });
		const type = data.type || defaultType;

		// Render the document creation form
		template ??= "templates/sidebar/document-create.html";
		const html = await foundry.applications.handlebars.renderTemplate(template, {
			folders, hasTypes, type,
			name: data.name || "",
			defaultName: cls.defaultName({ type, parent, pack }),
			folder: data.folder,
			hasFolders: folders.length >= 1,
			types: documentTypes,
			...context
		});
		const content = document.createElement("div");
		content.innerHTML = html;

		// Render the confirmation dialog window
		return foundry.applications.api.DialogV2.prompt(foundry.utils.mergeObject({
			content,
			window: { title }, // FIXME: double localization
			position: { width: 360 },
			render: (event, dialog) => {
				if (!hasTypes) return;
				dialog.element.querySelector('[name="type"]').addEventListener("change", (e) => {
					const nameInput = dialog.element.querySelector('[name="name"]');
					nameInput.placeholder = cls.defaultName({ type: e.target.value, parent, pack });
				});
			},
			ok: {
				label: title, // FIXME: double localization
				callback: (event, button) => {
					const fd = new foundry.applications.ux.FormDataExtended(button.form);
					foundry.utils.mergeObject(data, fd.object);
					if (!data.folder) delete data.folder;
					if (!data.name?.trim()) data.name = cls.defaultName({ type: data.type, parent, pack });
					return cls.create(data, { renderSheet: true, ...createOptions });
				}
			}
		}, dialogOptions));
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

	_filterAttributes(attributes, path) {
		return Object.fromEntries(
			Object.entries(attributes)
				.filter(([key, data]) => {
					const filtersSet = new Set([this.system.slug, this.name, true]);
					const playbookSet = Array.isArray(data.playbook)
						? new Set(data.playbook)
						: new Set([data.playbook]);
					return filtersSet.intersection(playbookSet).size;
				})
				.map(([key, data]) => {
					data.type ??= "Details";
					if (data.type === "Resource") {
						data.choices = [{ value: data.value, max: data.max }];
					} else if (data.value) {
						data.choices = [{ value: data.value }];
					} else data.choices = [];
					data.custom = false;
					data.path = path;
					return [key, data];
				})
		);
	}

	_getValidAttributes(actorType, actorTypes) {
		actorTypes ??= foundry.utils.duplicate(
			Object.fromEntries(Object.entries(game.pbta.sheetConfig?.actorTypes)
				.filter(([a, v]) => this.constructor._filterActorTypes([a, v], this.type)))
		);
		if (Object.keys(actorTypes).length) {
			actorType ||= Object.keys(actorTypes)[0];
			return {
				...this._filterAttributes(actorTypes[actorType]?.attributes ?? {}, "attributes"),
				...this._filterAttributes(actorTypes[actorType]?.details ?? {}, "details")
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

	static _filterActorTypes([key, data], type) {
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
