import { createActorResources } from "../shared.js";
import { ActorDataTemplate } from "./templates/actor.js";

export default class CharacterData extends ActorDataTemplate {
	static defineSchema() {
		const superFields = super.defineSchema();
		return {
			...superFields,
			advancements: new foundry.data.fields.NumberField({
				required: true, integer: true, min: 0, initial: 0, nullable: false
			}),
			// @todo consider removal
			playbook: new foundry.data.fields.SchemaField({
				name: new foundry.data.fields.StringField({ initial: "" }),
				slug: new foundry.data.fields.StringField({ initial: "" }),
				uuid: new foundry.data.fields.StringField({ initial: "" })
			}),
			resources: createActorResources()
		};
	}

	get baseType() {
		return "character";
	}
}
