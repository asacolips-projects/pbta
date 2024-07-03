/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export default class PbtaActorSheet extends ActorSheet {
	/** @override */
	constructor(...args) {
		super(...args);

		if (this.actor.limited) {
			this.options.width = 580;
			this.options.height = 500;

			this.position.width = 580;
			this.position.height = 500;
		}
	}

	/**
	 * IDs for items on the sheet that have been expanded.
	 * @type {Set<string>}
	 * @protected
	 */
	_expanded = new Set();

	/**
	 * Stats targetted by the Stat Shifting feature.
	 * @type {object}
	 * @protected
	 */
	_statShifting = {};

	/** @override */
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			classes: ["pbta", "sheet", "actor", "character"],
			width: 840,
			height: 780,
			scrollY: [".window-content"],
			tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "moves" }],
			dragDrop: [{ dragSelector: ".items-list .item" }]
		});
	}

	/* -------------------------------------------- */

	/** @override */
	get template() {
		const path = "systems/pbta/templates/actors";
		if (this.actor.limited) return `${path}/limited-sheet.html`;
		return `${path}/actor-sheet.html`;
	}

	/**
	 * Blocklist of item types that shouldn't be added to the actor.
	 * @returns {Set<string>}
	 */
	get unsupportedItemTypes() {
		return new Set(["npcMove", "tag"]);
	}

	/* -------------------------------------------- */

	render(force=false, options={}) {
		const playbook = this.actor.playbook.slug;
		if (playbook && !(this.options.classes.includes(`playbook-${playbook}`))) {
			this.options.classes.push(`playbook-${playbook}`);
		}
		return super.render(force, options);
	}

	async close(options={}) {
		this._statShifting = {};
		return super.close(options);
	}

	/* -------------------------------------------- */

	/** @override */
	async getData() {
		const source = this.actor.toObject();
		const context = {
			actor: this.actor,
			source: source.system,
			system: foundry.utils.duplicate(this.actor.system),
			items: Array.from(this.actor.items.toObject()).sort((a, b) => (a.sort || 0) - (b.sort || 0)),

			effects: this.actor.effects.map((e) => foundry.utils.deepClone(e)),
			owner: this.actor.isOwner,
			limited: this.actor.limited,
			options: this.options,
			editable: this.isEditable,
			cssClass: this.isEditable ? "editable" : "locked",
			isCharacter: this.actor.baseType === "character",
			isNPC: this.actor.baseType === "npc",
			config: CONFIG.PBTA,
			flags: foundry.utils.mergeObject({
				pbta: { rollMode: "def" } }, this.actor?.flags ?? {}
			),
			enrichmentOptions: {
				async: true,
				secrets: this.actor.isOwner,
				rollData: this.actor.getRollData(),
				relativeTo: this.actor
			},
			sheetSettings: [
				"hideRollFormula",
				"hideForward",
				"hideOngoing",
				"hideHold",
				"hideRollMode",
				"hideUses"
			].reduce((obj, key) => {
				obj[key] = game.settings.get("pbta", key);
				return obj;
			}, {})
		};

		// Prepare items.
		await this._prepareItems(context);
		await this._prepareAttrs(context);

		for (let [k, v] of Object.entries(context.system.details)) {
			context.system.details[k].enriched = await TextEditor.enrichHTML(v?.value ?? "", context.enrichmentOptions);
		}

		// Add playbooks.
		if (this.actor.baseType === "character") {
			const sheetConfig = foundry.utils.duplicate(game.pbta.sheetConfig);
			const validCharacterTypes = Object.fromEntries(
				Object.entries(sheetConfig.actorTypes)
					.filter(([k, v]) => [k, v?.baseType].includes("character"))
			);
			const hasMultipleCharacterTypes = Object.keys(validCharacterTypes).length > 1;
			context.playbooks = CONFIG.PBTA.playbooks
				.filter((p) => !hasMultipleCharacterTypes || [this.actor.sheetType, ""].includes(p.actorType))
				.map((p) => {
					return { name: p.name, uuid: p.uuid };
				});

			context.statToggle = sheetConfig?.statToggle ?? false;
			context.statToken = sheetConfig?.statToken ?? false;
			context.statClock = sheetConfig?.statClock ?? false;
			context.statSettings = sheetConfig.actorTypes[this.actor.baseType]?.stats ?? {};

			if (context.statSettings) {
				context.statSettings = foundry.utils.mergeObject(context.statSettings, {
					ask: { label: game.i18n.localize("PBTA.Ask"), value: 0 },
					prompt: { label: game.i18n.localize("PBTA.Prompt"), value: 0 },
					formula: { label: game.i18n.localize("PBTA.Formula"), value: 0 }
				});
			}

			if (game.pbta.sheetConfig.statShifting) {
				const stats = {};
				Object.entries(context.system.stats).forEach(([stat, data]) => {
					stats[stat] = { label: data.label, value: stat };
				});
				context.statShifting = {
					...foundry.utils.duplicate(game.pbta.sheetConfig.statShifting),
					up: this._statShifting?.up,
					down: this._statShifting?.down,
					stats
				};
			}

			// Set a warning for tokens.
			context.isToken = this.actor.token !== null;
		}

		this._sortStats(context);
		this._sortAttrs(context);

		// Return template data
		return context;
	}

	/**
	 * Prepare attributes for templates.
	 *
	 * The editor helper for TinyMCE editors is unable to handle dynamic props,
	 * so this helper adds a string that we'll use later for the name attribute
	 * on the HTML element.
	 *
	 * @param {object} context Data prop on actor.
	 */
	async _prepareAttrs(context) {
		for (let [attrKey, attrValue] of Object.entries(context.system.attributes)) {
			if (!attrValue.position) continue;
			const position = `attr${attrValue.position.capitalize()}`;
			if (!context.system[position]) context.system[position] = {};
			if (context.limited && !attrValue.limited) {
				delete context.system.attributes[attrKey];
				continue;
			}
			const playbook = attrValue.playbook;
			if (
				playbook
				&& typeof playbook !== "boolean"
				&& ![this.actor.playbook.name, this.actor.playbook.slug].includes(playbook)
			) {
				delete context.system.attributes[attrKey];
				continue;
			}
			context.system[position][attrKey] = attrValue;
			if (attrValue.type === "LongText") {
				context.system[position][attrKey].attrName = `system.attributes.${attrKey}.value`;
				context.system[position][attrKey].enriched =
					await TextEditor.enrichHTML(attrValue.value, context.enrichmentOptions);
			}
		}
	}

	_sortValues(context, sortKeys, dataPath) {
		const data = context.system[dataPath];
		context.system[dataPath] = Object.fromEntries(
			Object.keys(data)
				.sort((a, b) => sortKeys.indexOf(a) - sortKeys.indexOf(b))
				.map((key) => [key, data[key]])
		);
		for (let [key, value] of Object.entries(data)) {
			if (value.options && value.sort) {
				data[key].options = Object.fromEntries(
					Object.entries(data[key].options)
						.sort(([, a], [, b]) => a.label.localeCompare(b.label))
				);
			}
		}
	}

	/**
	 * Resort stats based on config.
	 *
	 * @param {object} context Data prop on actor.
	 */
	_sortStats(context) {
		const type = this.actor.sheetType;
		// Confirm the keys exist, and assign them to a sorting array if so.
		const sortKeys = Object.keys(game.pbta.sheetConfig.actorTypes?.[type]?.stats ?? {});
		if (sortKeys) {
			this._sortValues(context, sortKeys, "stats");
		}
	}

	/**
	 * Resort attributes based on config.
	 *
	 * Currently, the way that stats and attributes are applied as updates to
	 * actors can cause their keys to become improperly ordered. In a future
	 * version we'll need to TODO and fix the order at write time, but currently,
	 * this solves the immediate problem and reorders them at render time for the
	 * sheet.
	 *
	 * @param {object} context Data prop on actor.
	 */
	_sortAttrs(context) {
		const type = this.actor.sheetType;
		// Confirm the keys exist, and assign them to a sorting array if so.
		const sortKeys = Object.keys(game.pbta.sheetConfig.actorTypes?.[type]?.attributes ?? {});
		if (sortKeys) {
			for (let group of ["attrLeft", "attrTop"]) {
				this._sortValues(context, sortKeys, group);
			}
		}
	}

	/**
	 * Organize and classify Items for Character sheets.
	 * @param {object} context The actor to prepare.
	 */
	async _prepareItems(context) {
		const moveType = this.actor.baseType === "npc" ? "npcMove" : "move";

		const sheetConfig = game.pbta.sheetConfig;
		const moveTypes = sheetConfig.actorTypes?.[this.actor.sheetType]?.moveTypes;
		const equipmentTypes = sheetConfig.actorTypes?.[this.actor.sheetType]?.equipmentTypes;

		context.moveTypes = {};
		context.moves = {};

		let items = context.items;

		if (moveTypes) {
			for (let [k, v] of Object.entries(moveTypes)) {
				context.moveTypes[k] = v.label;
				context.moves[k] = [];
			}
		}

		context.equipmentTypes = {};
		context.equipment = {};

		if (equipmentTypes) {
			for (let [k, v] of Object.entries(equipmentTypes)) {
				context.equipmentTypes[k] = v.label;
				context.equipment[k] = [];
			}
		}

		if (!context.equipment.PBTA_OTHER) {
			context.equipment.PBTA_OTHER = [];
		}
		if (!context.moves.PBTA_OTHER) {
			context.moves.PBTA_OTHER = [];
		}

		// Iterate through items, allocating to containers
		// let totalWeight = 0;
		for (let item of items) {
			item.img = item.img || Item.DEFAULT_ICON;
			const sourceItem = this.actor.items.get(item._id) ?? {};
			const enrichmentOptions = {
				async: true,
				secrets: this.actor.isOwner,
				rollData: sourceItem?.getRollData() ?? {},
				relativeTo: sourceItem
			};
			// Enrich text fields.
			if (item.system?.description) {
				item.system.description =
					await TextEditor.enrichHTML(item.system.description, enrichmentOptions);
			}
			if (item.system?.choices) {
				item.system.choices = await TextEditor.enrichHTML(item.system.choices, enrichmentOptions);
			}
			if (item.system?.moveResults) {
				for (let [mK, mV] of Object.entries(item.system.moveResults)) {
					if (mV.value) {
						item.system.moveResults[mK].value =
							await TextEditor.enrichHTML(mV.value, enrichmentOptions);
					}
				}
			}
			item.isExpanded = this._expanded.has(item.id);
			// If this is a move, sort into various arrays.
			if (item.type === moveType) {
				if (context.moves[item.system.moveType]) {
					context.moves[item.system.moveType].push(item);
				} else {
					context.moves.PBTA_OTHER.push(item);
				}
			} else if (item.type === "equipment") {
				// If this is equipment, we currently lump it together.
				if (context.equipment[item.system.equipmentType]) {
					context.equipment[item.system.equipmentType].push(item);
				} else {
					context.equipment.PBTA_OTHER.push(item);
				}
			}
		}
	}

	/* -------------------------------------------- */

	/** @override */
	activateListeners(html) {
		super.activateListeners(html);

		// Rollables.
		html.find(".rollable, .showable").on("click", this._onRollable.bind(this));

		html.find(".profile-img").on("contextmenu", () => {
			if (!this.actor.img) return;
			new ImagePopout(this.actor.img, {
				title: this.actor.name,
				shareable: this.actor.isOwner ?? game.user?.isGM,
				uuid: this.actor.uuid
			}).render(true);
		});

		// // View playbook.
		html.find(".charplaybook").on("change", async (event) => {
			const currPlaybook = this.actor.playbook;
			if (currPlaybook.slug) {
				this.options.classes = this.options.classes.filter((c) => c !== `playbook-${currPlaybook.slug}`);
			}

			const selected = CONFIG.PBTA.playbooks.find((p) => p.uuid === event.target.value);
			if (currPlaybook.uuid) {
				const deleted = await this.actor.items.find((i) => i.type === "playbook")?.delete();
				if (!deleted) {
					event.target.value = currPlaybook.uuid;
					event.stopPropagation();
					return;
				}
			}
			// @todo replace for slug
			if (selected) await this.actor.createEmbeddedDocuments("Item", [await fromUuid(selected.uuid)], { keepId: true, originalUuid: selected.uuid });
		});
		html.find(".view-playbook[data-playbook]").on("click", this._onViewPlaybook.bind(this));

		// // Owned Item management
		html.find(".item-create").on("click", this._onItemCreate.bind(this));
		html.find(".item-edit").on("click", this._onItemEdit.bind(this));
		html.find(".item-delete").on("click", this._onItemDelete.bind(this));

		// Moves
		html.find(".item-group-label").on("click", this._hideMoveGroup.bind(this));
		html.find(".item-label").on("click", this._showItemDetails.bind(this));

		// Attributes.
		html.find(".attr-clock, .attr-xp").on("click", this._onClockClick.bind(this));
		html.find(".attr-track-value").on("click", this._onTrackValueClick.bind(this));
		html.find(".attr-track-step").on("click", this._onTrackStepClick.bind(this));

		// Stats.
		html.find(".stat-clock").on("click", this._onStatClockClick.bind(this));
		html.find(".stat-shift label").on("click", this._onStatShiftClick.bind(this));
		html.find(".stat-shift .up, .stat-shift .down").on("change", this._onStatShiftChange.bind(this));
		html.find(".token-modif").on("click", this._onStatTokenClick.bind(this));

		// Quantity.
		for (const attribute of ["quantity", "uses"]) {
			html.find(`.item-meta .tag--${attribute}`).on({
				click: this._onUsagesControl.bind(this, `system.${attribute}`, 1),
				contextmenu: this._onUsagesControl.bind(this, `system.${attribute}`, -1)
			});
		}

		// Resources.
		html.find(".resource-control").on("click", this._onResourceControl.bind(this));
	}

	_onResourceControl(event) {
		event.preventDefault();
		const { action, attr } = event.currentTarget.dataset;
		// If there's an action and target attribute, update it.
		if (action && attr) {
			const system = {
				[attr]: Number(foundry.utils.getProperty(this.actor.system, attr))
			};
			if (action === "decrease" || action === "increase") {
				system[attr] += (action === "decrease" ? -1 : 1);
				this.actor.update({ system });
			}
		}
	}

	async _onClockClick(event) {
		event.preventDefault();
		const dataset = event.currentTarget.dataset;
		// Get the clicked value.
		let index = Number(dataset.step) + 1; // Adjust for 1-index

		// Retrieve the attribute.
		const prop = dataset.name;
		const attr = foundry.utils.deepClone(foundry.utils.getProperty(this.actor, prop));

		// Handle clicking the same checkbox to unset its value.
		const unset = event.currentTarget.attributes.checked !== undefined;
		if (unset && attr.value === index) {
			index--;
		}

		// Update the stored value.
		attr.value = index;

		// Update the actor/token.
		await this.actor.update({ [prop]: attr });
	}

	async updateTrackThreshold(attr) {
		// eslint-disable-next-line no-constant-condition
		while (true) {
			let negativeThreshold = (-Math.min(attr.value, 0) + 1) * attr.negative.steps;
			let positiveThreshold = (Math.max(attr.value, 0) + 1) * attr.positive.steps;

			if (attr.negative.value >= negativeThreshold && -attr.value < attr.negative.max) {
				attr.negative.value -= negativeThreshold;
				attr.value--;
				continue;
			}
			if (attr.positive.value >= positiveThreshold && attr.value < attr.positive.max) {
				attr.positive.value -= positiveThreshold;
				attr.value++;
				continue;
			}

			break;
		}
	}

	async _onTrackValueClick(event) {
		event.preventDefault();
		const $self = $(event.currentTarget);

		let value = parseInt($self.data("value"));
		let prop = $self.data("name");

		let attr = foundry.utils.getProperty(this.actor, prop);
		attr.value = value;
		if (value === 0) {
			attr.positive.value = 0;
			attr.negative.value = 0;
		} else {
			this.updateTrackThreshold(attr);
		}
		game.pbta.utils.updateAttrCellTrackDisplay(attr);

		let update = {};
		update[prop] = attr;

		this.actor.update(update);
	}

	async _onTrackStepClick(event) {
		event.preventDefault();
		const $self = $(event.currentTarget);

		let value = parseInt($self.data("value"));
		let step = parseInt($self.data("step"));
		let prop = $self.data("name");

		let attr = foundry.utils.getProperty(this.actor, prop);
		if (value > 0) {
			let newValue = ((value - 1) * attr.positive.steps) + step + 1;
			if (attr.positive.value === newValue && newValue === 1) {
				attr.positive.value = 0;
			} else {
				attr.positive.value = newValue;
			}
		} else {
			let newValue = -((value + 1) * attr.negative.steps) + step + 1;
			if (attr.negative.value === newValue && newValue === 1) {
				attr.negative.value = 0;
			} else {
				attr.negative.value = newValue;
			}
		}
		this.updateTrackThreshold(attr);
		game.pbta.utils.updateAttrCellTrackDisplay(attr);

		let update = {};
		update[prop] = attr;

		this.actor.update(update);
	}

	// @todo add a _shrinked set to persist shrinking, similar to the _expanded set.
	_hideMoveGroup(event) {
		event.preventDefault();
		const toggler = $(event.currentTarget);
		const group = toggler.parents(".cell--group");
		const description = group.find(".items-list");

		toggler.toggleClass("open");
		description.slideToggle(200);
	}

	_showItemDetails(event) {
		event.preventDefault();
		const toggler = $(event.currentTarget);
		const item = toggler.parents(".item");
		const description = item.find(".item-description");

		toggler.toggleClass("open");
		if (description.hasClass("expanded")) {
			this._expanded.delete(item.data().itemId);
			description.slideUp(200);
		} else {
			this._expanded.add(item.data().itemId);
			description.slideDown(200);
		}
		description.toggleClass("expanded");
	}

	_onStatShiftChange(event) {
		event.preventDefault();
		const classList = event.currentTarget.classList;
		if (classList.contains("up")) this._statShifting.up = event.target.value;
		else if (classList.contains("down")) this._statShifting.down = event.target.value;
	}

	_onStatTokenClick(event) {
		event.preventDefault();
		const { action, attr } = event.currentTarget.dataset;
		const { min, max } = game.pbta.sheetConfig.statToken;
		if (action && attr) {
			const system = {
				[attr]: Number(foundry.utils.getProperty(this.actor.system, attr))
			};
			if ((action === "decrease" && system[attr] > min)
				|| (action === "increase" && system[attr] < max)) {
				system[attr] += (action === "decrease" ? -1 : 1);
				this.actor.update({ system });
			}
		}
	}

	async _onStatClockClick(event) {
		event.preventDefault();
		const $self = $(event.currentTarget);
		// Get the clicked value.
		let step = Number($self.data("step")) + 1;
		const stepValue = $self.attr("checked") !== undefined;

		// Retrieve the attribute.
		const prop = $self.data("name");
		const attr = foundry.utils.deepClone(foundry.utils.getProperty(this.actor, prop));

		// Handle clicking the same checkbox to unset its value.
		if (stepValue) {
			if (attr.steps.value === step) {
				step--;
			}
		}

		// Update the steps.
		attr.steps.value = step;

		// Update the actor/token.
		await this.actor.update({ [prop]: attr });
	}

	async _onStatShiftClick(event) {
		event.preventDefault();
		const { up, down } = this._statShifting;
		if ((!up && !down) || (up === down)) return;

		const { maxMod, minMod, statShifting } = game.pbta.sheetConfig;
		const { labels, value } = statShifting;

		const system = {};
		let fail = false;

		if (up) {
			const newValue = this.actor.system.stats[up].value + value;
			if (maxMod && newValue > maxMod) fail = true;
			else system[`stats.${up}.value`] = newValue;
		}
		if (down) {
			const newValue = this.actor.system.stats[down].value - value;
			if (minMod && newValue < minMod) fail = true;
			else system[`stats.${down}.value`] = newValue;
		}

		if (!fail) await this.actor.update({ system });
		this._statShifting = {};
		this.render(false);

		const content = await renderTemplate("systems/pbta/templates/chat/stat-shift.hbs", {
			actor: this.actor,
			labels,
			up: up ? this.actor.system.stats[up] : "",
			down: down ? this.actor.system.stats[down] : "",
			fail
		});

		ChatMessage.create({
			user: game.user.id,
			content: content,
			speaker: ChatMessage.getSpeaker({ actor: this.actor }),
			type: CONST.CHAT_MESSAGE_STYLES.OTHER
		});
	}

	/**
	 * Adjust a numerical field on click.
	 * @param {string} property
	 * @param {int} delta
	 * @param {MouseEvent} event
	 */
	async _onUsagesControl(property, delta, event) {
		event.preventDefault();
		const a = event.currentTarget;
		const itemId = $(a).parents(".item")
			.attr("data-item-id");
		const item = this.actor.items.get(itemId);

		if (item) {
			const originalAmount = Number(foundry.utils.getProperty(item.toObject(), property)) || 0;
			if (originalAmount + delta >= 0) {
				await item.update({ [property]: originalAmount + delta });
				this.render();
			}
		}
	}

	/**
	 * Listen for click events on rollables.
	 * @param {MouseEvent} event
	 */
	async _onRollable(event) {
		event.preventDefault();
		this.actor._onRoll(event);
	}

	/**
	 * Listen for click events on view playbook.
	 * @param {MouseEvent} event
	 */
	async _onViewPlaybook(event) {
		// Initialize variables.
		event.preventDefault();
		this.actor.items.find((i) => i.type === "playbook")?.sheet.render(true);
	}

	/* -------------------------------------------- */
	/**
	 * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
	 * @param {Event} event   The originating click event
	 * @private
	 */
	async _onItemCreate(event) {
		event.preventDefault();
		const header = event.currentTarget;
		const type = header.dataset.type;
		const dataset = foundry.utils.duplicate(header.dataset);
		const system = {};
		if (dataset.moveType) {
			system.moveType = dataset.moveType;
		}
		if (dataset.equipmentType) {
			system.equipmentType = dataset.equipmentType;
		}
		const itemData = {
			name: CONFIG.Item.documentClass.defaultName({ type, parent: this.actor }),
			type: type,
			system: system
		};
		await this.actor.createEmbeddedDocuments("Item", [itemData], { renderSheet: true });
	}

	/* -------------------------------------------- */

	/**
	 * Handle editing an existing Owned Item for the Actor
	 * @param {Event} event   The originating click event
	 * @private
	 */
	_onItemEdit(event) {
		event.preventDefault();
		const li = event.currentTarget.closest(".item");
		const item = this.actor.items.get(li.dataset.itemId);
		item.sheet.render(true);
	}

	/* -------------------------------------------- */

	async _onDropItem(event, data) {
		if (!this.actor.isOwner) return false;
		const item = await Item.implementation.fromDropData(data);
		const itemData = item.toObject();

		// Handle item sorting within the same Actor
		if (this.actor.uuid === item.parent?.uuid) {
			const groupCell = event.target.closest(".cell--group");
			if (!groupCell) return false;
			let key = groupCell.dataset.key;
			if (key === "PBTA_OTHER") key = "";
			const itemType = item.system?.moveType ?? item.system?.equipmentType;
			if (itemType !== undefined && itemType !== key) {
				if (itemData.system.moveType !== undefined) itemData.system.moveType = key;
				else if (itemData.system.equipmentType !== undefined) itemData.system.equipmentType= key;

				return this.actor.updateEmbeddedDocuments("Item", [itemData]);
			}
			return this._onSortItem(event, itemData);
		}

		if (item.type === "playbook") {
			const hasMultipleCharacterTypes = Object.keys(game.pbta.sheetConfig.actorTypes)
				.filter((a) => a === "character" || game.pbta.sheetConfig.actorTypes[a]?.baseType === "character")
				.length > 1;
			if (
				hasMultipleCharacterTypes
				&& ![this.actor.sheetType, ""].includes(item.system.actorType)
			) return false;

			const currPlaybook = this.actor.items.find((i) => i.type === "playbook");
			if (currPlaybook && item.system.slug === currPlaybook.system.slug) {
				// @todo update sets and valid, non-granted choices
				return false;
			}
			/**
			 * @todo create a replacePlaybook method with this and @see activateListeners() also handle stats
			 */
			if (item.type === "playbook" && currPlaybook) {
				const deleted = await currPlaybook.delete();
				if (!deleted) return false;
			}
		}

		// Create the owned item
		return this._onDropItemCreate(itemData);
	}

	/* -------------------------------------------- */

	async _onDropItemCreate(itemData) {
		const items = Array.isArray(itemData) ? itemData : [itemData];
		const toCreate = items.filter((item) => !this.unsupportedItemTypes.has(item.type));
		// Create the owned items as normal
		return this.actor.createEmbeddedDocuments("Item", toCreate);
	}

	/* -------------------------------------------- */

	/**
	 * Handle deleting an existing Owned Item for the Actor
	 * @param {Event} event   The originating click event
	 * @private
	 */
	async _onItemDelete(event) {
		event.preventDefault();
		const li = event.currentTarget.closest(".item");
		let item = this.actor.items.get(li.dataset.itemId);
		item.deleteDialog();
	}

	/* -------------------------------------------- */

	// @todo currently unused
	async _activateTagging(html) {
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
			let tagName = tag.toLowerCase();
			if (tagNames.includes(tagName) === false) {
				tagNames.push(tagName);
			}
		}

		// Sort the tagnames list.
		tagNames.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

		// Tagify!
		let $input = html.find('input[name="system.tags"]');
		if ($input.length > 0) {
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
