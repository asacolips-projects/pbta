import { ActorDataTemplate } from "./templates/actor.js";

export default class NpcData extends ActorDataTemplate {
	static defineSchema() {
		const superFields = super.defineSchema();
		return {
			...superFields,
			// @todo consider removal if tags are added to ActorDataTemplate
			tags: new foundry.data.fields.StringField({ initial: "" })
		};
	}
}
