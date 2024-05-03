import PbtaItemSheet from "./item-sheet.js";

export default class PlaybookSheet extends PbtaItemSheet {
	/** @override */
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			classes: ["pbta", "sheet", "item", "playbook"],
			dragDrop: [
				{ dragSelector: ".choiceset-item", dropSelector: ".choiceset" }
			]
		});
	}

	/* -------------------------------------------- */

	/** @override */
	async getData() {
		const context = await super.getData();
		return context;
	}

	/* -------------------------------------------- */

	/** @override */
	async activateListeners(html) {
		super.activateListeners(html);
		html.find("select[name='system.actorType']").on("change", this._onChangeStats.bind(this));
		html.find("button[data-action='add']").on("click", this._onAddChoiceSet.bind(this));
		html.find("button[data-action='delete']").on("click", this._onDeleteChoiceSet.bind(this));
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
		const fieldset = event.target.closest("fieldset");
		if (!fieldset) return;
		const id = fieldset.dataset.id;
		this.item.update({ [`system.choiceSets.-=${id}`]: null });
	}

	/* -------------------------------------------- */

	_onDrop(event) {
		const data = TextEditor.getDragEventData(event);
		if (!["Item", "Folder"].includes(data.type)) return super._onDrop(event, data);

		// if ( data.type === "Folder" ) return this._onDropFolder(event, data);
		return this._onDropItem(event, data);
	}

	async _onDropItem(event, data) {
		const { id: setId } = event.target.dataset;
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
