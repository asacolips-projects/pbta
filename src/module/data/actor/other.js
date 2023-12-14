import { createActorResources } from "../shared.js";
import { ActorDataTemplate } from "./templates/actor.js";

export default class OtherData extends ActorDataTemplate {
	static defineSchema() {
		const superFields = super.defineSchema();

		// Character Data
		superFields.details.fields.playbook = new foundry.data.fields.StringField({ initial: "" });

		return {
			...superFields,
			resources: createActorResources(),
			customType: new foundry.data.fields.StringField({ initial: "" }),

			// NPC Data
			tags: new foundry.data.fields.ArrayField(new foundry.data.fields.StringField()),
			tagsString: new foundry.data.fields.StringField({ initial: "" })
		};
	}
}
