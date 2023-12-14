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
			playbook: new foundry.data.fields.SchemaField({
				name: new foundry.data.fields.StringField({ initial: "" }),
				slug: new foundry.data.fields.StringField({ initial: "" }),
				uuid: new foundry.data.fields.StringField({ initial: "" }),
			}),

			// NPC Data
			tags: new foundry.data.fields.ArrayField(new foundry.data.fields.StringField())
		};
	}

	/**
	 * Migrate source data from some prior format into a new specification.
	 * The source parameter is either original data retrieved from disk or provided by an update operation.
	 * @inheritDoc
	 */
	static migrateData(source) {
		if (source.details && "playbook" in source.details) {
			source.playbook = {
				name: source.details.playbook,
				slug: source.details.playbook.slugify(),
				uuid: ""
			};
			delete source.details.playbook;
		}
		return super.migrateData(source);
	}
}
