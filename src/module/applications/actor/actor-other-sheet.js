import PbtaActorSheet from "./actor-sheet.js";

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export default class PbtaActorOtherSheet extends PbtaActorSheet {
	/** @override */
	constructor(...args) {
		super(...args);

		if (this.actor.baseType === "npc") {
			this.options.classes.push("npc");

			this.options.width = 720;
			this.options.height = 640;

			this.position.width = 720;
			this.position.height = 640;
		} else {
			this.options.classes.push("character");
		}
	}

	/** @override */
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			classes: ["pbta", "sheet", "actor"],
			width: 840,
			height: 780
		});
	}

	get unsupportedItemTypes() {
		if (this.actor.baseType === "character") {
			return new Set(["npcMove", "playbook", "tag"]);
		}
		return new Set(["move", "playbook", "tag"]);
	}
}
