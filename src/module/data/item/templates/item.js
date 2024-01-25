export class ItemTemplateData extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return {
			description: new foundry.data.fields.HTMLField()
		};
	}
}
