import { MappingField } from "../../shared.js";

export class ItemTemplateData extends foundry.abstract.DataModel {
	static defineSchema() {
		return {
			description: new foundry.data.fields.HTMLField()
		};
	}
}
