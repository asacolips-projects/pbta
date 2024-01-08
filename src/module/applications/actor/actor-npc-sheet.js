import PbtaActorSheet from "./actor-sheet.js";

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export default class PbtaActorNpcSheet extends PbtaActorSheet {

	/** @override */
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			classes: ["pbta", "sheet", "actor", "npc"],
			width: 720,
			height: 640
		});
	}

	get unsupportedItemTypes() {
		return new Set(["move", "playbook", "tag"]);
	}
}
