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
		// @todo add warnings about repeat grants
		const context = await super.getData();
		context.grantOptions = {
			0: "PBTA.PlaybookGrantOnDrop",
			1: "PBTA.Advancement"
		};
		const choicesByAdvancement = {};
		this.item.system.choiceSets.forEach((cs, index) => {
			if (!choicesByAdvancement[cs.advancement]) choicesByAdvancement[cs.advancement] = {};
			if (!choicesByAdvancement[cs.advancement][index]) choicesByAdvancement[cs.advancement][index] = [];
			choicesByAdvancement[cs.advancement][index].push(cs);
		});
		context.choicesByAdvancement = choicesByAdvancement;
		for (let [k, v] of Object.entries(context.system.attributes)) {
			if (["Details", "LongText"].includes(v.type)) {
				for (const choice of context.system.attributes[k].choices) {
					choice.enriched = await TextEditor.enrichHTML(choice.value ?? "", context.enrichmentOptions);
				}
			}
		}
		const numOfAttributes = Object.keys(this.item.system.attributes).length;
		const numOfValidAttributes = Object.keys(this.item._getValidAttributes(this.item.system.actorType)).length;
		context.numOfAttributes = Math.abs(numOfAttributes - numOfValidAttributes);
		return context;
	}

	/* -------------------------------------------- */

	/** @override */
	async activateListeners(html) {
		super.activateListeners(html);
		html.find("select[name='system.actorType']").on("change", this._onChangeActorType.bind(this));
		html.find("[data-action='add-choiceset']").on("click", this._onAddChoiceSet.bind(this));
		html.find("[data-action='delete-choiceset']").on("click", this._onDeleteChoiceSet.bind(this));
		html.find("[data-action='delete-item']").on("click", this._onDeleteItem.bind(this));
		// @todo add click event on item's img/label to render the item
		html.find("[data-action='update-attributes']").on("click", this._onUpdateAttributes.bind(this));
		html.find("[data-tab='attributes'] [data-action='add-attribute-choice']").on("click", this._onAddAttributeChoice.bind(this));
		html.find("[data-tab='attributes'] [data-action='delete-attribute-choice']").on("click", this._onDeleteAttributeChoice.bind(this));
		html.find("[data-tab='attributes'] [data-action='add-list-option']").on("click", this._onAddNewOption.bind(this));
	}

	_onChangeActorType(event) {
		event.preventDefault();
		const actorType = event.target.value;
		const stats = {};
		const prevStats = this.item.system.stats;
		const newStats = foundry.utils.deepClone(game.pbta.sheetConfig?.actorTypes[actorType]?.stats ?? {});
		Object.keys(newStats).forEach((k) => stats[`${k}`] = newStats[k]);
		Object.keys(prevStats).forEach((k) => {
			if (!stats[k]) stats[`-=${k}`] = null;
		});
		const attributes = this.item._getValidAttributes(actorType);
		this.item.update({
			"system.actorType": actorType,
			"system.attributes": attributes,
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

	_onUpdateAttributes(event) {
		event.preventDefault();
		const attributes = this.item._getUpdatedAttributes();
		this.item.update({ "system.attributes": attributes });
	}

	_onAddAttributeChoice(event) {
		event.preventDefault();
		const { key, type } = event.target.closest(".attribute-set").dataset;
		const attributes = this.item.system.attributes;
		const { value, options, max } = attributes[key];
		if (type === "Resource") attributes[key].choices.push({ value, max });
		else if (["ListMany", "ListOne"].includes(type)) {
			attributes[key].choices.push({ options });
		} else attributes[key].choices.push({ value });
		this.item.update({ "system.attributes": attributes });
	}

	_onDeleteAttributeChoice(event) {
		event.preventDefault();
		const { key } = event.target.closest(".attribute-set").dataset;
		const { id } = event.target.closest(".form-group").dataset;
		const attributes = this.item.system.attributes;
		attributes[key].choices = attributes[key].choices.filter((item, index) => index !== Number(id));
		this.item.update({ "system.attributes": attributes });
	}

	_onAddNewOption(event) {
		event.preventDefault();
		const { key } = event.target.closest(".attribute-set").dataset;
		const { id } = event.target.closest(".form-group").dataset;
		const attributes = this.item.system.attributes;
		const next = Object.keys(attributes[key].choices[id].options).length;
		attributes[key].choices[id].options[next] = {};
		this.item.update({ "system.attributes": attributes });
	}

	/* -------------------------------------------- */

	async _onDragStart(event) {
		const li = event.currentTarget;
		if (event.target.classList.contains("content-link")) return;
		if (!li.closest(".choiceset-item").dataset.uuid) return super._onDragStart(event);

		const dragData = this._getEntryDragData(li.closest(".choiceset-item").dataset.uuid);
		if (!dragData) return;

		// Set data transfer
		event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
	}

	_getEntryDragData(entryId) {
		const entry = this.item.system.choiceSets.findIndex(
			(cs) => cs.choices
				.find((c) => c.uuid === entryId)
		);
		if (Number.isNumeric(entry)) {
			return {
				choiceSet: entry,
				type: "Item",
				uuid: entryId
			};
		}
	}

	async _onDrop(event) {
		const data = TextEditor.getDragEventData(event);
		if (!["Item", "Folder"].includes(data.type)) return super._onDrop(event, data);

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
		const item = await Item.implementation.fromDropData(data);

		const { sheetConfig } = game.pbta;
		const actorType = this.item.system.actorType;
		const validCharacterTypes = Object.fromEntries(
			Object.entries(sheetConfig.actorTypes)
				.filter(([k, v]) => [k, v?.baseType].includes("character"))
		);

		const hasMultipleCharacterTypes = Object.keys(validCharacterTypes).length > 1;
		if (hasMultipleCharacterTypes && ![actorType, ""].includes(item.system.actorType)) return false;

		if (item.system.moveType) {
			const moveTypes = (validCharacterTypes[actorType] ?? validCharacterTypes.character).moveTypes;
			if (moveTypes && moveTypes[item.system.moveType]?.creation) return false;
		}

		const { img, name, type, uuid } = item;

		const { id: setId } = event.target.closest(".choiceset").dataset;
		const choiceSets = this.item.system.choiceSets;

		if (this.unsupportedItemTypes.has(type)) return false;
		if (data.choiceSet === Number(setId)) return false; // return this._onSortItem(event, item, setId);
		if (choiceSets[setId].choices.find((c) => c.uuid === uuid)) {
			ui.notifications.warn("PBTA.Warnings.Playbook.ChoiceSetAlreadyGrant", { localize: true });
			return false;
		}
		if ("choiceSet" in data && data.choiceSet !== Number(setId)) {
			choiceSets[data.choiceSet].choices = choiceSets[data.choiceSet].choices
				.filter((c) => c.uuid !== uuid);
		}
		choiceSets[setId].choices.push({
			name,
			img,
			uuid,
			granted: false,
			advancement: 0
		});
		choiceSets[setId].choices.sort(this.item._sortItemAdvancement);
		return await this.item.update({ "system.choiceSets": choiceSets });
	}

	_onSortItem(event, item, setId) {
		const newPos = event.target.closest(".choiceset-item");
		if (!newPos) return false;
		const choiceSets = this.item.system.choiceSets;
		const choices = choiceSets[setId].choices;
		const oldIndex = choices.findIndex((c) => c.uuid === item.uuid);
		const newIndex = Number(newPos.dataset.id);
		if (
			oldIndex === newIndex
			|| choices[oldIndex].advancement > choices[newIndex].advancement
		) return false;
		this._sortArray(choices, newIndex, oldIndex);
		return this.item.update({ "system.choiceSets": choiceSets });
	}

	_sortArray(array, newIndex, oldIndex) {
		if (newIndex >= array.length) {
			let k = newIndex - array.length + 1;
			while (k--) {
				array.push(undefined);
			}
		}
		array.splice(newIndex, 0, array.splice(oldIndex, 1)[0]);
	}
}
