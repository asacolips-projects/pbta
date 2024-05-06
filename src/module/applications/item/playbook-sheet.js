import PbtaItemSheet from "./item-sheet.js";

export default class PlaybookSheet extends PbtaItemSheet {
	/** @override */
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			classes: ["pbta", "sheet", "item", "playbook"],
			width: 550,
			dragDrop: [
				{ dragSelector: ".choiceset-item .item", dropSelector: ".choiceset" }
			]
		});
	}

	/* -------------------------------------------- */

	/** @override */
	async getData() {
		const context = await super.getData();
		context.grantOptions = {
			0: "On Drop",
			1: "Advancement"
		};
		return context;
	}

	/* -------------------------------------------- */

	/** @override */
	async activateListeners(html) {
		super.activateListeners(html);
		html.find("select[name='system.actorType']").on("change", this._onChangeStats.bind(this));
		html.find("[data-action='add-choiceset']").on("click", this._onAddChoiceSet.bind(this));
		html.find("[data-action='delete-choiceset']").on("click", this._onDeleteChoiceSet.bind(this));
		html.find("[data-action='delete-item']").on("click", this._onDeleteItem.bind(this));
		html.find("[name='granton']").on("change", this._onChoiceSetGrantOn.bind(this));
		html.find("[name='advancement']").on("change", this._onChoiceSetAdvancement.bind(this));
		html.find("[name='item-advancement']").on("change", this._onItemGrantAdvancementChange.bind(this));
	}

	_onChangeStats(event) {
		event.preventDefault();
		const actorType = event.target.value;
		const stats = foundry.utils.deepClone(game.pbta.sheetConfig?.actorTypes[actorType]?.stats);
		const prevStats = this.item.system.stats;
		Object.keys(prevStats).forEach((k) => stats[`-=${k}`] = null);
		this.item.update({
			"system.actorType": actorType,
			"system.stats": stats
		});
	}

	_onAddChoiceSet(event) {
		event.preventDefault();
		const choiceSets = this.item.system.choiceSets ?? {};
		choiceSets[foundry.utils.randomID(8)] = {
			title: "",
			type: "single",
			choices: [],
			grantOn: 0
		};
		this.item.update({ "system.choiceSets": choiceSets });
	}

	_onDeleteChoiceSet(event) {
		event.preventDefault();
		const { id } = event.target.closest(".choiceset").dataset;
		if (!id) return;
		this.item.update({ [`system.choiceSets.-=${id}`]: null });
	}

	_onDeleteItem(event) {
		event.preventDefault();
		const { uuid } = event.target.closest(".choiceset-item").dataset;
		const { id } = event.target.closest(".choiceset").dataset;
		if (!uuid || !id) return;
		const choiceset = this.item.system.choiceSets[id];
		const choices = choiceset.choices.filter((i) => i.uuid !== uuid);
		this.item.update({ [`system.choiceSets.${id}.choices`]: choices });
	}

	_onChoiceSetGrantOn(event) {
		event.preventDefault();
		const { id } = event.target.closest(".choiceset").dataset;
		if (!id) return;
		this.item.update({ [`system.choiceSets.${id}.grantOn`]: Number(event.target.value) });
	}

	_onChoiceSetAdvancement(event) {
		event.preventDefault();
		const { id } = event.target.closest(".choiceset").dataset;
		if (!id) return;
		if (!Number.isNumeric(event.target.value)) return this.render();
		this.item.update({ [`system.choiceSets.${id}.advancement`]: Number(event.target.value) });
	}

	_onItemGrantAdvancementChange(event) {
		event.preventDefault();
		const { uuid } = event.target.closest(".choiceset-item").dataset;
		const { id } = event.target.closest(".choiceset").dataset;
		if (!uuid || !id) return;
		if (!Number.isNumeric(event.target.value)) return this.render();
		const choices = this.item.system.choiceSets[id].choices;
		choices.find((c) => c.uuid === uuid).advancement = Number(event.target.value);
		this.item.update({ [`system.choiceSets.${id}.choices`]: choices });
	}

	/* -------------------------------------------- */

	_onDrop(event) {
		const data = TextEditor.getDragEventData(event);
		if (!["Item", "Folder"].includes(data.type) || data.subtype === "playbook") return super._onDrop(event, data);

		if (data.type === "Folder") return this._onDropFolder(event, data);
		return this._onDropItem(event, data);
	}

	async _onDropFolder(event, data) {
		const folder = await Folder.implementation.fromDropData(data);
		if (!this.item.isOwner || (folder.type !== "Item")) return [];

		await Promise.all(folder.contents.map(async (item) => {
			if (!(item instanceof Item)) item = await fromUuid(item.uuid);
			if (item.type === "playbook") return;
			return this._onDropItem(event, item.toDragData());
		}));
	}

	async _onDropItem(event, data) {
		// @todo add sorting
		const { id: setId } = event.target.closest(".choiceset").dataset;
		const choiceSets = this.item.system.choiceSets;
		const { img, name, uuid } = data;
		choiceSets[setId].choices.push({
			name,
			img,
			uuid,
			granted: false,
			advancement: 0
		});
		this.item.update({ "system.choiceSets": choiceSets });
	}
}
