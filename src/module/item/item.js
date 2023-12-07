import { RollPbtA } from "../rolls.js";

export class ItemPbta extends Item {
	static getDefaultArtwork(itemData) {
		if (itemData.type === "move" || itemData.type === "npcMove") {
			return { img: "icons/svg/upgrade.svg" };
		} else if (itemData.type === "playbook") {
			return { img: "icons/svg/book.svg" };
		} else if (itemData.type === "tag") {
			return { img: "systems/pbta/assets/icons/svg/tag.svg" };
		}
		return { img: this.DEFAULT_ICON };
	}

	/** @override */
	getRollData() {
		let data = super.getRollData();
		data.type = this.type;
		if (this.actor && this.actor.system?.stats) {
			data = foundry.utils.mergeObject(data, this.actor.getRollData());
		}
		data.formula = this.getRollFormula();
		return data;
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
	 * Roll the item to Chat, creating a chat card which contains follow up attack or damage roll options
	 * @param {boolean} descriptionOnly
	 * @param {object} options
	 */
	async roll({ descriptionOnly = false } = {}, options = {}) {
		if (!descriptionOnly && (this.type === "equipment" || (this.type !== "npcMove" && !this.system.rollType))) {
			descriptionOnly = true;
		}
		if (descriptionOnly) {
			const content = await renderTemplate("systems/pbta/templates/chat/chat-move.html", {
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
				if (this.actor.system.stats[stat].toggle) {
					formula += " + 0";
				} else {
					formula += ` + @stats.${stat}.value`;
				}
			}
			if (rollMod) {
				formula += " + @rollMod";
			}
			const templateData = {
				title: this.name,
				details: this.system.description,
				moveResults: this.system.moveResults,
				choices: this.system?.choices,
				sheetType: this.actor?.baseType,
				rollType,
			};
			const r = new RollPbtA(formula, this.getRollData(), foundry.utils.mergeObject(options, {
				rollType: this.type,
				sheetType: this.actor?.baseType,
				stat
			}));
			const choice = await r.configureDialog({
				templateData,
				title: game.i18n.format("PBTA.RollLabel", { label: this.name })
			});
			if (choice === null) {
				return;
			}
			await r.toMessage({
				image: this.img,
				title: this.name
			});
			await this.actor?.clearForwardAdv();
			await this.actor.updateCombatMoveCount();
		}
	}

	/** @inheritdoc */
	async _preCreate(data, options, userId) {
		await super._preCreate(data, options, userId);

		if (this.type === "move" || this.type === "npcMove") {
			const templateData = duplicate(this);
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
				system: mergeObject(templateData.system, this.toObject(false).system)
			});
		}
	}

	static async createDialog(data={}, {parent=null, pack=null, ...options}={}) {

		// Collect data
		const documentName = this.metadata.name;
		const types = game.documentTypes[documentName].filter((t) => t !== CONST.BASE_DOCUMENT_TYPE && t !== "tag");
		let collection;
		if ( !parent ) {
			if ( pack ) {
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
				foundry.utils.mergeObject(data, fd.object, {inplace: true});
				if ( !data.folder ) {
					delete data.folder;
				}
				if ( types.length === 1 ) {
					data.type = types[0];
				}
				if ( !data.name?.trim() ) {
					data.name = this.defaultName();
				}
				return this.create(data, {parent, pack, renderSheet: true});
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
		html.on("click", ".cell__title", this._onChatCardToggleContent.bind(this));
		html.on("click", ".result-label", this._onChatCardResultToggleContent.bind(this));
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
