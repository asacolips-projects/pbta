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
	"Roll"
];

PBTA.sheetConfigs = [
	"maxMod",
	"minMod",
	"rollFormula",
	"rollResults",
	"rollShifting",
	"statClock",
	"statShifting",
	"statToggle",
	"statToken"
];

PBTA.playbooks = [];

PBTA.rollModes = {
	def: "PBTA.Normal",
	adv: "PBTA.Advantage",
	dis: "PBTA.Disadvantage"
};
