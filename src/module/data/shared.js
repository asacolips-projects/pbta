import { FormulaField, MappingField } from "./fields.js";

/**
 * Creates the base actor resources.
 * @returns {*}
 */
export function createActorResources() {
	return new foundry.data.fields.SchemaField({
		forward: new foundry.data.fields.SchemaField({
			value: new foundry.data.fields.NumberField({
				initial: 0,
				integer: true
			})
		}),
		ongoing: new foundry.data.fields.SchemaField({
			value: new foundry.data.fields.NumberField({
				initial: 0,
				integer: true
			})
		}),
		rollFormula: new FormulaField({ initial: "" })
	});
}

/**
 * Creates the base item resources.
 * @returns {*}
 */
export function createItemResources() {
	return {
		use: new foundry.data.fields.NumberField({
			initial: 0,
			integer: true
		})
	};
}

/**
 * Creates the base move data that is shared between Moves and NPC Moves.
 * @returns {*}
 */
export function createMoveData() {
	return {
		moveType: new foundry.data.fields.StringField(),
		rollFormula: new FormulaField({ initial: "" }),
		moveResults: new MappingField(
			new foundry.data.fields.SchemaField({
				key: new foundry.data.fields.StringField({ initial: "" }),
				label: new foundry.data.fields.StringField({ initial: "" }),
				value: new foundry.data.fields.HTMLField(),
			})
		)
	};
}
