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

	get unsupportedItemTypes() {
		return new Set(["npcMove", "playbook", "tag"]);
	}

	/* -------------------------------------------- */

	/** @override */
	async getData() {
		const context = await super.getData();
		context.grantOptions = {
			0: "On Drop",
			1: "Advancement"
		};
		const choicesByAdvancement = {};
		this.item.system.choiceSets.forEach((cs, index) => {
			if (!choicesByAdvancement[cs.advancement]) choicesByAdvancement[cs.advancement] = {};
			if (!choicesByAdvancement[cs.advancement][index]) choicesByAdvancement[cs.advancement][index] = [];
			choicesByAdvancement[cs.advancement][index].push(cs);
		});
		context.choicesByAdvancement = choicesByAdvancement;
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
		const choiceSets = this.item.system.choiceSets ?? [];
		// @todo add Creation Dialog
		choiceSets.push({
			title: "",
			desc: "",
			type: "multi",
			repeatable: true,
			choices: [],
			grantOn: 0,
			advancement: 0
		});
		this.item.update({ "system.choiceSets": choiceSets });
	}

	_onDeleteChoiceSet(event) {
		event.preventDefault();
		const { id } = event.target.closest(".choiceset").dataset;
		if (!id) return;
		const choiceSets = this.item.system.choiceSets.filter((item, index) => index !== Number(id));
		this.item.update({ "system.choiceSets": choiceSets });
	}

	_onDeleteItem(event) {
		event.preventDefault();
		const { id: index } = event.target.closest(".choiceset-item").dataset;
		const { id } = event.target.closest(".choiceset").dataset;
		if (!index || !id) return;
		const choiceSets = this.item.system.choiceSets;
		choiceSets[id].choices = choiceSets[id].choices.filter((item, _index) => _index !== Number(index));
		this.item.update({ "system.choiceSets": choiceSets });
	}

	_onItemGrantAdvancementChange(event) {
		event.preventDefault();
		const { id: index } = event.target.closest(".choiceset-item").dataset;
		const { id } = event.target.closest(".choiceset").dataset;
		if (!index || !id) return;
		if (!Number.isNumeric(event.target.value)) return;
		const choiceSets = this.item.system.choiceSets;
		choiceSets[id].choices[index].advancement = Number(event.target.value);
		this.item.update({ "system.choiceSets": choiceSets });
	}

	/* -------------------------------------------- */

	async _onDrop(event) {
		const data = TextEditor.getDragEventData(event);
		if (!["Item", "Folder"].includes(data.type) || this.unsupportedItemTypes.has(data.subtype)) {
			return super._onDrop(event, data);
		}

		if (data.type === "Folder") return this._onDropFolder(event, data);
		return await this._onDropItem(event, data);
	}

	async _onDropFolder(event, data) {
		const folder = await Folder.implementation.fromDropData(data);
		if (!this.item.isOwner || (folder.type !== "Item")) return [];

		await Promise.all(folder.contents.map(async (item) => {
			if (!(item instanceof Item)) item = await fromUuid(item.uuid);
			if (this.unsupportedItemTypes.has(item.type)) return;
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
		return await this.item.update({ "system.choiceSets": choiceSets });
	}
}
