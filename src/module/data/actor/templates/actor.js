import { MappingField } from "../../fields.js";

export class ActorDataTemplate extends foundry.abstract.DataModel {
	static defineSchema() {
		return {
			stats: new foundry.data.fields.ObjectField(),
			attrTop: new foundry.data.fields.ObjectField(),
			attrLeft: new foundry.data.fields.ObjectField(),
			details: new MappingField(new foundry.data.fields.SchemaField({
				label: new foundry.data.fields.StringField({ initial: "" }),
				value: new foundry.data.fields.HTMLField({ initial: "" })
			}))
		};
	}

	/**
	 * Migrate source data from some prior format into a new specification.
	 * The source parameter is either original data retrieved from disk or provided by an update operation.
	 * @inheritDoc
	 */
	static migrateData(source) {
		if (source.details) {
			if ("biography" in source.details && typeof source.details.biography === "string") {
				source.details.biography = {
					label: game.i18n.localize("PBTA.Biography"),
					value: source.details.biography
				};
			}
			if ("playbook" in source.details) {
				source.playbook = {
					name: source.details.playbook,
					slug: source.details.playbook.slugify(),
					uuid: ""
				};
				delete source.details.playbook;
			}
		}
		if (source.resources && typeof source.resources.rollFormula === "object") {
			source.resources.rollFormula = source.resources.rollFormula.value;
		}
		if (game.pbta.sheetMigration) {
			game.pbta.sheetMigration(source);
		}
		return super.migrateData(source);
	}
}
