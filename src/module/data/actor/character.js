import { createActorResources } from "../shared.js";
import { ActorDataTemplate } from "./templates/actor.js";

export default class CharacterData extends ActorDataTemplate {
	static defineSchema() {
		const superFields = super.defineSchema();
		superFields.details.fields.playbook = new foundry.data.fields.StringField({ initial: '' });
		return {
			...superFields,
			resources: createActorResources()
		};
	}
}