import { MappingField } from "../../fields.js";

export class ActorDataTemplate extends foundry.abstract.DataModel {
	static defineSchema() {
		return {
			stats: new foundry.data.fields.ObjectField(),
			attrTop: new foundry.data.fields.ObjectField(),
			attrLeft: new foundry.data.fields.ObjectField(),
			details: new MappingField(new foundry.data.fields.HTMLField(),
				{ initialKeys: ["biography"] })
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
