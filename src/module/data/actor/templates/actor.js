import { MappingField } from "../../fields.js";

export class ActorDataTemplate extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return {
			stats: new foundry.data.fields.ObjectField(),
			attributes: new foundry.data.fields.ObjectField(),
			attrLeft: new foundry.data.fields.ObjectField({ readonly: true }),
			attrTop: new foundry.data.fields.ObjectField({ readonly: true }),
			details: new MappingField(new foundry.data.fields.SchemaField({
				label: new foundry.data.fields.StringField({ initial: "" }),
				value: new foundry.data.fields.HTMLField({ initial: "" })
			}))
		};
	}

	prepareDerivedData() {
		for (const data of Object.values(this.attributes)) {
			console.log("preparing derived data for", data);
			if (["ListOne", "ListMany"].includes(data.type) && data.options) {
				for (let optV of Object.values(data.options)) {
					if (optV.values) {
						const optArray = Object.values(optV.values);
						optV.value = optArray.some((subOpt) => subOpt.value);
					}
				}
			}

			if (data.type === "MultiText" && data.lines && !data.options) {
				// if (data.options) {
				//
				// } else {
					data.options = Array(data.lines).fill("");
				// }
			}

		}
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
