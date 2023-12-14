import { ItemTemplateData } from "./templates/item.js";

export default class PlaybookData extends ItemTemplateData {
	static defineSchema() {
		return {
			description: new foundry.data.fields.HTMLField(),
			slug: new foundry.data.fields.StringField({ initial: "" })
		};
	}
}
