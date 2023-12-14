import { ActorDataTemplate } from "./templates/actor.js";

export default class NpcData extends ActorDataTemplate {
	static defineSchema() {
		const superFields = super.defineSchema();
		return {
			...superFields,
			tags: new foundry.data.fields.ArrayField(new foundry.data.fields.StringField())
		};
	}
}
