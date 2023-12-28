export const PBTA = {};

PBTA.attrTypes = [
	"Number",
	"Clock",
	"Xp",
	"Resource",
	"Text",
	"LongText",
	"Checkbox",
	"ListMany",
	"ListOne",
	"Roll",
	"Track"
];

PBTA.sheetConfigs = [
	"maxMod",
	"minMod",
	"rollFormula",
	"rollResults",
	"rollShifting",
	"statClock",
	"statShifting",
	"statToggle"
];

PBTA.playbooks = [];

PBTA.rollModes = {
	def: "PBTA.Normal",
	adv: "PBTA.Advantage",
	dis: "PBTA.Disadvantage"
};
