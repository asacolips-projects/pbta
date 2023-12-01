import { createItemResources, createMoveData } from "../shared.js";
import { ItemTemplateData } from "./templates/item.js";

export default class NpcMoveData extends ItemTemplateData {
	static defineSchema() {
		const superFields = super.defineSchema();
		return {
			...superFields,
			...createMoveData(),
			...createItemResources()
		};
	}
}