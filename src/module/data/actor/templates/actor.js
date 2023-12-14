export class ActorDataTemplate extends foundry.abstract.DataModel {
	static defineSchema() {
		return {
			stats: new foundry.data.fields.ObjectField(),
			attrTop: new foundry.data.fields.ObjectField(),
			attrLeft: new foundry.data.fields.ObjectField(),
			details: new foundry.data.fields.SchemaField({
				biography: new foundry.data.fields.HTMLField()
			})
		};
	}
}
