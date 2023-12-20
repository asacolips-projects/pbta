import { ItemTemplateData } from "./templates/item.js";

export default class PlaybookData extends ItemTemplateData {
	static defineSchema() {
		return {
			description: new foundry.data.fields.HTMLField({ initial: "" }),
			slug: new foundry.data.fields.StringField({
				required: true,
				validate: (value) => {
					if (value !== value.slugify()) {
						return new foundry.data.validation.DataModelValidationFailure({
							unresolved: true,
							invalidValue: value,
							message: `${value} is not a valid slug`,
						});
					}
				}
			})
		};
	}
}
