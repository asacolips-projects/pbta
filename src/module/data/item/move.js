import { createItemResources, createMoveData } from "../shared.js";
import { ItemTemplateData } from "./templates/item.js";

export default class MoveData extends ItemTemplateData {
	static defineSchema() {
		const superFields = super.defineSchema();
		return {
			...superFields,
			...createMoveData(),
			...createItemResources(),
			playbook: new foundry.data.fields.StringField({ initial: "" }),
			rollType: new foundry.data.fields.StringField({ initial: "" }),
			rollMod: new foundry.data.fields.NumberField({
				initial: 0,
				integer: true
			}),
			actorType: new foundry.data.fields.StringField({ initial: "" })
		};
	}
}
