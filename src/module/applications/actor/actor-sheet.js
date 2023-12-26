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
			dragDrop: [{dragSelector: ".items-list .item"}]
		});
	}

	/* -------------------------------------------- */

	/** @override */
	get template() {
		const path = "systems/pbta/templates/actors";
		// @todo add limited sheet
		if (this.actor.limited) return `${path}/limited-sheet.html`;
		return `${path}/actor-sheet.html`;
	}

	get unsupportedItemTypes() {
		return new Set(["npcMove", "tag"]);
	}

	/* -------------------------------------------- */

	render(force=false, options={}) {
		if (!this.actor.limited) {
			const playbook = this.actor.playbookSlug;
			if (playbook && !(this.options.classes.includes(`playbook-${playbook}`))) {
				this.options.classes.push(`playbook-${playbook}`);
			}
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
			items: Array.from(this.actor.items).sort((a, b) => (a.sort || 0) - (b.sort || 0)),

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
				pbta: { rollMode: "def" }}, this.actor?.flags ?? {}
			),
			enrichmentOptions: {
				secrets: this.actor.isOwner,
				rollData: this.actor.getRollData(),
				relativeTo: this.actor
			},
			sheetSettings: [
				"hideRollFormula",
				"hideForward",
				"hideOngoing",
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

		Object.entries(context.system.details).forEach(async ([k, v]) => {
			if (v.value) {
				context.system.details[k].value = await TextEditor.enrichHTML(v.value, context.enrichmentOptions);
			}
		});

		// Add playbooks.
		if (this.actor.baseType === "character") {
			const hasMultipleCharacterTypes = Object.keys(game.pbta.sheetConfig.actorTypes)
				.filter((a) => a === "character" || game.pbta.sheetConfig.actorTypes[a]?.baseType === "character")
				.length;
			context.playbooks = CONFIG.PBTA.playbooks
				.filter((p) => !hasMultipleCharacterTypes || p.actorType === this.actor.type || p.actorType === "")
				.map((p) => {
					return { name: p.name, uuid: p.uuid };
				});

			const sheetConfig = foundry.utils.duplicate(game.pbta.sheetConfig);
			context.statToggle = sheetConfig?.statToggle ?? false;
			context.statSettings = sheetConfig.actorTypes[this.actor.baseType]?.stats ?? {};

			if (context.statSettings) {
				context.statSettings = foundry.utils.mergeObject(context.statSettings, {
					ask: { label: game.i18n.localize("PBTA.Ask"), value: 0 },
					prompt: { label: game.i18n.localize("PBTA.Prompt"), value: 0 },
					formula: { label: game.i18n.localize("PBTA.Formula"), value: 0 }
				});
			}

			if (game.pbta.sheetConfig.statShifting) {
				context.statShifting = {
					...foundry.utils.duplicate(game.pbta.sheetConfig.statShifting),
					up: this._statShifting?.up,
					down: this._statShifting?.down,
				};
			}

			// Set a warning for tokens.
			context.isToken = this.actor.token !== null;
		}

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
		const groups = ["attrTop", "attrLeft"];
		for (let group of groups) {
			for (let [attrKey, attrValue] of Object.entries(context.system[group])) {
				if (context.limited && !attrValue.limited) {
					delete context.system[group][attrKey];
					continue;
				}
				const playbook = attrValue.playbook;
				if (playbook && ![this.actor.playbook, this.actor.playbookSlug].includes(playbook)) {
					delete context.system[group][attrKey];
					continue;
				}
				if (attrValue.type === "LongText") {
					context.system[group][attrKey].attrName = `system.${group}.${attrKey}.value`;
					context.system[group][attrKey].value =
						await TextEditor.enrichHTML(attrValue.value, context.enrichmentOptions);
				}
			}
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
		let groups = [
			"stats",
			"attrTop",
			"attrLeft"
		];
		// Iterate through the groups that need to be sorted.
		for (let group of groups) {
			// Confirm the keys exist, and assign them to a sorting array if so.
			let sortKeys = game.pbta.sheetConfig.actorTypes?.[context.pbtaSheetType]?.[group];
			let sortingArray = [];
			if (sortKeys) {
				sortingArray = Object.keys(sortKeys);
			} else {
				continue;
			}
			// Grab the keys of the group on the actor.
			let newData = Object.keys(context.system[group])
			// Sort them based on the sorting array.
				.sort((a, b) => {
					return sortingArray.indexOf(a) - sortingArray.indexOf(b);
				})
			// Build a new object from the sorted keys.
				.reduce(
					(obj, key) => {
						obj[key] = context.system[group][key];
						return obj;
					}, {}
				);

			// Replace the data object handed over to the sheet.
			context.system[group] = newData;
		}
	}

	/**
	 * Organize and classify Items for Character sheets.
	 * @param {object} context The actor to prepare.
	 */
	async _prepareItems(context) {
		const actorType = this.actor.baseType;
		const moveType = this.actor.baseType === "npc" ? "npcMove" : "move";

		const sheetConfig = game.pbta.sheetConfig;
		const moveTypes = sheetConfig?.actorTypes[actorType]?.moveTypes;
		const equipmentTypes = sheetConfig?.actorTypes[actorType]?.equipmentTypes;

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
			// Enrich text fields.
			if (item.system?.description) {
				item.system.description =
					await TextEditor.enrichHTML(item.system.description, context.enrichmentOptions);
			}
			if (item.system?.choices) {
				item.system.choices = await TextEditor.enrichHTML(item.system.choices, context.enrichmentOptions);
			}
			if (item.system?.moveResults) {
				for (let [mK, mV] of Object.entries(item.system.moveResults)) {
					if (mV.value) {
						item.system.moveResults[mK].value =
							await TextEditor.enrichHTML(mV.value, context.enrichmentOptions);
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

		// // View playbook.
		html.find(".charplaybook").on("change", (event) => {
			const currPlaybook = this.actor.playbookSlug;
			if (currPlaybook) {
				this.options.classes = this.options.classes.filter((c) => c !== `playbook-${currPlaybook}`);
			}

			const selected = CONFIG.PBTA.playbooks.find((p) => p.uuid === event.target.value);
			this.actor.update({"system.playbook": {
				name: selected?.name ?? "",
				slug: selected?.slug ?? selected?.name.slugify() ?? "",
				uuid: selected?.uuid ?? "",
			} });
		});
		html.find(".view-playbook").on("click", this._onViewPlaybook.bind(this));

		// // Toggle look.
		html.find(".toggle--look").on("click", this._toggleLook.bind(this, html));

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
		html.find(".stat-shift label").on("click", this._onStatShiftClick.bind(this));
		html.find(".stat-shift .up, .stat-shift .down").on("change", this._onStatShiftChange.bind(this));

		// Quantity.
		html.find(".item-meta .tag--quantity").on("click", this._onUsagesControl.bind(this, "system.quantity", 1));
		html.find(".item-meta .tag--quantity").on("contextmenu", this._onUsagesControl.bind(this, "system.quantity", -1));

		html.find(".item-meta .tag--uses").on("click", this._onUsagesControl.bind(this, "system.uses", 1));
		html.find(".item-meta .tag--uses").on("contextmenu", this._onUsagesControl.bind(this, "system.uses", -1));

		// Resources.
		html.find(".resource-control").on("click", this._onResouceControl.bind(this));
	}

	_onResouceControl(event) {
		event.preventDefault();
		const control = $(event.currentTarget);
		const action = control.data("action");
		const attr = control.data("attr");
		// If there's an action and target attribute, update it.
		if (action && attr) {
			// Initialize data structure.
			let system = {};
			let changed = false;
			// Retrieve the existin value.
			system[attr] = Number(getProperty(this.actor.system, attr));
			// Decrease the value.
			if (action === "decrease") {
				system[attr] -= 1;
				changed = true;
			} else if (action === "increase") {
				// Increase the value.
				system[attr] += 1;
				changed = true;
			}
			// If there are changes, apply to the actor.
			if (changed) {
				this.actor.update({ system: system });
			}
		}
	}

	async _onClockClick(event) {
		event.preventDefault();
		const $self = $(event.currentTarget);
		// Get the clicked value.
		let step = Number($self.data("step"));
		let stepValue = $self.attr("checked") !== undefined;

		// Retrieve the attribute.
		let prop = $self.data("name");
		let attr = foundry.utils.deepClone(getProperty(this.actor, prop));

		// Step is offset by 1 (0 index). Adjust and fix.
		step++;

		// Handle clicking the same checkbox to unset its value.
		if (stepValue) {
			if (attr.value === step) {
				step--;
			}
		}

		// Update the stored value.
		attr.value = step;

		// Update the steps.
		for (let i = 0; i < attr.max; i++) {
			if ((i) < attr.value) {
				attr.steps[i] = true;
			} else {
				attr.steps[i] = false;
			}
		}

		// Prepare updates.
		let update = {};
		update[prop] = attr;

		// Update the actor/token.
		this.actor.update(update);
	}

	async updateTrackThreshold(attr) {
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

		let attr = getProperty(this.actor, prop);
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

		let attr = getProperty(this.actor, prop);
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

		if (!fail) await this.actor.update({system});
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
			type: CONST.CHAT_MESSAGE_TYPES.OTHER
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
			const originalAmount = Number(getProperty(item.toObject(), property)) || 0;
			if (originalAmount + delta >= 0) {
				await item.update({ [property]: originalAmount + delta});
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
		const a = event.currentTarget;
		const playbookUuid = a.getAttribute("data-playbook");
		const playbook = await fromUuid(playbookUuid);
		if (playbook) {
			playbook.sheet.render(true);
		}
	}

	/**
	 * Listen for toggling the look column.
	 * @param {HTMLElement} html
	 * @param {MouseEvent} event
	 */
	_toggleLook(html, event) {
		// Add a class to the sidebar.
		html.find(".sheet-look").toggleClass("closed");

		// Add a class to the toggle button.
		let $look = html.find(".toggle--look");
		$look.toggleClass("closed");
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
		if (dataset.movetype) {
			system.moveType = dataset.movetype;
		}
		if (dataset.equipmenttype) {
			system.equipmentType = dataset.equipmenttype;
		}
		const itemData = {
			name: `New ${type.capitalize()}`,
			type: type,
			system: system
		};
		await this.actor.createEmbeddedDocuments("Item", [itemData], {});
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

	async _onDropItemCreate(itemData) {
		const items = Array.isArray(itemData) ? itemData : [itemData];
		const toCreate = [];
		for (const item of items) {
			if (!this.unsupportedItemTypes.has(item.type)) {
				if (item.type === "playbook") {
					this.actor.update({ "system.playbook": {
						name: item.name,
						slug: item.slug ?? item.name.slugify(),
						uuid: item.uuid
					} });
				} else {
					toCreate.push(item);
				}
			}
		}

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
		item.delete();
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
