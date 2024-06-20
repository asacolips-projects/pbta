import { createActorResources } from "../shared.js";
import { ActorDataTemplate } from "./templates/actor.js";

export default class OtherData extends ActorDataTemplate {
	static defineSchema() {
		const superFields = super.defineSchema();
		return {
			...superFields,
			resources: createActorResources(),
			customType: new foundry.data.fields.StringField({ initial: "" }),

			// Character Data
			advancements: new foundry.data.fields.NumberField({
				required: true, integer: true, min: 0, initial: 0, nullable: false
			}),
			// @todo consider removal
			playbook: new foundry.data.fields.SchemaField({
				name: new foundry.data.fields.StringField({ initial: "" }),
				slug: new foundry.data.fields.StringField({ initial: "" }),
				uuid: new foundry.data.fields.StringField({ initial: "" })
			}),

			// NPC Data
			tags: new foundry.data.fields.StringField({ initial: "" })
		};
	}

	get baseType() {
		return game.pbta.sheetConfig.actorTypes[this.customType]?.baseType ?? "character";
	}
}
