import { PBTA } from "./config.js";
export class PbtaUtility {
	static cleanClass(string, hyphenate = true) {
		let replace = hyphenate ? "-" : "";
		// Lower case everything
		string = string.toLowerCase();
		// Make alphanumeric (removes all other characters)
		string = string.replace(/[^a-z0-9\s]/g, "");
		// Convert whitespaces and underscore to dash
		string = string.replace(/[\s_]/g, replace);
		// Clean up multiple dashes or whitespaces
		string = string.replace(/[\s-]+/g, replace);
		return string;
	}

	static toTitleCase(str) {
		return str.replace(
			/\w*/g,
			function (txt) {
				return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
			}
		);
	}

	/**
	 * Validate sheetConfig settings and return errors.
	 * @param {object} sheetConfig Computed sheetConfig settings.
	 * @returns {Array}
	 */
	static validateSheetConfig(sheetConfig) {
		let errors = [];
		const t = {
			rollFormulaRequired: game.i18n.localize("PBTA.Messages.sheetConfig.rollFormulaRequired"),
			rollResultsRequired: game.i18n.localize("PBTA.Messages.sheetConfig.rollResultsRequired"),
			rollResultsIncorrect: game.i18n.localize("PBTA.Messages.sheetConfig.rollResultsIncorrect"),
			actorTypeRequired: game.i18n.localize("PBTA.Messages.sheetConfig.actorTypeRequired"),
			statString1: game.i18n.localize("PBTA.Messages.sheetConfig.statString1"),
			statString2: game.i18n.localize("PBTA.Messages.sheetConfig.statString2"),
			statsRequired1: game.i18n.localize("PBTA.Messages.sheetConfig.statsRequired1"),
			statsRequired2: game.i18n.localize("PBTA.Messages.sheetConfig.statsRequired2"),
			groupAttributes: game.i18n.localize("PBTA.Messages.sheetConfig.groupAttributes"),
			attribute: game.i18n.localize("PBTA.Messages.sheetConfig.attribute"),
			attributeType: game.i18n.localize("PBTA.Messages.sheetConfig.attributeType"),
			attributeTypeNull: game.i18n.localize("PBTA.Messages.sheetConfig.attributeTypeNull"),
			attributeMax: game.i18n.localize("PBTA.Messages.sheetConfig.attributeMax"),
			attributeOptions: game.i18n.localize("PBTA.Messages.sheetConfig.attributeOptions"),
			attributeOptionsEmpty: game.i18n.localize("PBTA.Messages.sheetConfig.attributeOptionsEmpty"),
			moveTypes: game.i18n.localize("PBTA.Messages.sheetConfig.moveTypes"),
			equipmentTypes: game.i18n.localize("PBTA.Messages.sheetConfig.equipmentTypes"),
		};

		// Handle rollFormula.
		if (!sheetConfig.rollFormula) {
			errors.push(`${t.rollFormulaRequired}`);
		}

		//  Handle rollResults.
		if (!sheetConfig.rollResults) {
			errors.push(`${t.rollResultsRequired}`);
		}
		if (typeof sheetConfig.rollResults !== "object" || Object.keys(sheetConfig.rollResults).length < 1) {
			errors.push(`${t.rollResultsIncorrect}`);
		}

		// Handle actor config.
		let actorTypes = ["character", "npc"];
		if (game.pbta.sheetConfig.actorTypes) {
			for (let actorType of Object.keys(game.pbta.sheetConfig.actorTypes)) {
				if (!actorTypes.includes(actorType)) {
					actorTypes.push(actorType);
				}
			}
		}

		// Iterate through the actor types.
		for (let actorType of actorTypes) {
			// Error for missing actor type.
			if (!sheetConfig[actorType] && ["character", "npc"].includes(actorType)) {
				errors.push(`'${actorType}' ${t.actorTypeRequired}`);
				continue;
			}

			// Store this in an easier to reference variable.
			let actorConfig = sheetConfig[actorType];

			if (!actorConfig) {
				continue;
			}

			// Validate stats.
			if (actorConfig.stats) {
				if (actorConfig.stats.length > 0) {
					for (let [k, v] of actorConfig.stats) {
						if (typeof v !== "string") {
							errors.push(`${t.statString1} "${k}" ${t.statString2}`);
						}
					}
				}
			} else if (actorType === "character" || actorConfig[actorType]?.baseType === "character") {
				// Stats are required for characters (but not for NPCs).
				errors.push(`${t.statsRequired1} '${actorType}' ${t.statsRequired2}.`);
			}

			// Validate attribute groups.
			let attrGroups = ["attributesTop", "attributesLeft"];
			for (let attrGroup of attrGroups) {
				// If an attribute group is present, validate it.
				if (actorConfig[attrGroup]) {
					// Groups must be objects.
					if (typeof actorConfig[attrGroup] !== "object") {
						errors.push(`'${actorType}.${attrGroup}' ${t.groupAttributes}`);
					} else {
						// Iterate through each attribute.
						for (let [attr, attrValue] of Object.entries(actorConfig[attrGroup])) {
							// Confirm the attribute type is valid.
							let attrType = typeof attrValue === "object" && attrValue.type ? attrValue.type : attrValue;
							if (!PBTA.attrTypes.includes(attrType)) {
								errors.push(`${t.attribute} '${actorType}.${attrGroup}.${attr}' ${t.attributeType} ${PBTA.attrTypes.join(", ")}.`);
							}

							if (typeof attrType === "object") {
								errors.push(`${t.attribute} '${actorType}.${attrGroup}.${attr}' ${t.attributeTypeNull}`);
								continue;
							}

							// If this is a clock or XP, require a max value. Resources also
							// have a max prop, but those can be freely edited by the user and
							// are therefore not required.
							if (attrType === "Clock" || attrType === "Xp") {
								if (!attrValue.max) {
									errors.push(`${t.attribute} '${actorType}.${attrGroup}.${attr}' ${t.attributeMax}`);
								}
							}

							// Handle list types.
							if (attrType === "ListMany" || attrType === "ListOne") {
								if (!attrValue.options) {
									errors.push(`${t.attribute} '${actorType}.${attrGroup}.${attr}' ${t.attributeOptions}`);
								} else if (typeof attrValue.options !== "object" || Object.keys(attrValue.options).length < 1) {
									errors.push(`${t.attribute} '${actorType}.${attrGroup}.${attr}' ${t.attributeOptionsEmpty}`);
								}
							}
						}
					}
				}
			}

			// Validate that the movetypes are included as an array.
			if (!actorConfig.moveTypes || typeof actorConfig.moveTypes !== "object" || Object.keys(actorConfig.moveTypes).length < 1) {
				errors.push(`'${actorType}.moveTypes' ${t.moveTypes}`);
			}

			// Validate that the movetypes are included as an array.
			if (actorConfig.equipmentTypes) {
				if (typeof actorConfig.equipmentTypes !== "object" || Object.keys(actorConfig.equipmentTypes).length < 1) {
					errors.push(`'${actorType}.equipmentTypes' ${t.equipmentTypes}`);
				}
			}
		}

		// Return the array of errors for output.
		return errors;
	}

	static parseTomlString(tomlString) {
		let computed = {};
		let errors = [];

		// Try to retrieve the TOML string.
		if (tomlString) {
			// Get the parsed value.
			try {
				computed = toml.parse(tomlString);
			} catch(error) {
				// Catch and report parser errors.
				console.error(error);
				errors = [game.i18n.format("PBTA.Messages.sheetConfig.tomlError", {
					line: error.line,
					column: error.column
				})];
			}

			// If the TOML was parsed successfully, check it for validation errors.
			if (!foundry.utils.isEmpty(computed)) {
				errors = PbtaUtility.validateSheetConfig(computed);
			}
		} else {
			// If there's no TOML string, report an error.
			errors = [game.i18n.localize("PBTA.Messages.sheetConfig.noConfig")];
		}

		// If there are errors, output them.
		if (errors.length > 0) {
			for (let error of errors) {
				ui.notifications.error(error, {permanent: true});
			}
			throw new Error(errors.join("\r\n"));
		}

		return computed;
	}

	static parseRange(rangeString) {
		// Split the result range into an array.
		let range = rangeString.split(/[-+]/g);

		// If the array is invalid, exit early.
		if (range.length !== 2 || range[0] === "") {
			return null;
		}

		// Get the start and end numbers. Start should always be numeric,
		// e.g. 6- rather than -6.
		let start = Number(range[0]);
		let end = range[1] !== "" ? Number(range[1]) : null;

		// If there's only one digit, assume it's N+ or N-.
		if (end === null) {
			// If it's minus, set the start to null (less than or equal).
			if (range.includes("-")) {
				return {
					start: null,
					end: start
				};
			}

			// If it's plus, set the end to null (greater than or equal).
			if (range.includes("+")) {
				return {
					start: start,
					end: null
				};
			}
		}
		// Otherwise, set the full range.
		return {
			start: start,
			end: end
		};
	}

	static convertSheetConfig(sheetConfig) {
		const newConfig = {};

		for (let [k, v] of Object.entries(sheetConfig)) {
			if (k === "rollFormula") {
				let rollFormula = v.trim();
				let validRoll = Roll.validate(rollFormula);
				newConfig.rollFormula = validRoll ? rollFormula : "";
			} else if (k === "rollShifting") {
				newConfig.rollShifting = v;
			} else if (k === "statToggle") {
				if (!v) {
					newConfig.statToggle = false;
				} else if (typeof v === "object" && v.label) {
					newConfig.statToggle = {
						label: v.label,
						modifier: v.modifier ? v.modifier : 0
					};
				} else {
					newConfig.statToggle = {
						label: v,
						modifier: 0
					};
				}
			} else if (k === "rollResults") {
				newConfig.rollResults = {};
				// Set result ranges.
				for (let [rollKey, rollSetting] of Object.entries(v)) {
					if (typeof rollSetting.range === "string") {
						// Exit early if the range type isn't specified.
						if (!rollSetting.range) {
							continue;
						}

						// Split the result range into an array.
						let range = rollSetting.range.split(/[-+]/g);
						let rollResult = {};

						// If the array is invalid, exit early.
						if (range.length !== 2 || range[0] === "") {
							continue;
						}

						// Get the start and end numbers. Start should always be numeric,
						// e.g. 6- rather than -6.
						let start = Number(range[0]);
						let end = range[1] !== "" ? Number(range[1]) : null;

						// If there's only one digit, assume it's N+ or N-.
						if (end === null) {
							// If it's minus, set the start to null (less than or equal).
							if (rollSetting.range.includes("-")) {
								rollResult = {
									start: null,
									end: start,
									label: rollSetting.label
								};
							}

							// If it's plus, set the end to null (greater than or equal).
							if (rollSetting.range.includes("+")) {
								rollResult = {
									start: start,
									end: null,
									label: rollSetting.label
								};
							}
						} else {
							// Otherwise, set the full range.
							rollResult = {
								start: start,
								end: end,
								label: rollSetting.label
							};
						}

						// Update teh sheet config with this result range.
						newConfig.rollResults[rollKey] = rollResult;
					}
				}
			} else if (k === "minMod") {
				newConfig.minMod = v;

			} else if (k === "maxMod") {
				newConfig.maxMod = v;
			} else if (v.label || v.stats || v.attributesTop || v.attributesLeft || v.moveTypes || v.equipmentTypes) {
				// Actors
				let actorType = {};
				if (v.label) {
					actorType.label = game.i18n.localize(v.label);
				}
				if (v.stats) {
					actorType.stats = {};
					for (let [statKey, statLabel] of Object.entries(v.stats)) {
						let cleanKey = PbtaUtility.cleanClass(statKey, false);
						if (["ask", "formula", "prompt"].includes(cleanKey)) {
							continue;
						}

						actorType.stats[cleanKey] = {
							label: statLabel,
							value: 0
						};
					}
				}

				if (v.attributesTop) {
					actorType.attrTop = PbtaUtility.convertAttr(v.attributesTop);
				}
				if (v.attributesLeft) {
					actorType.attrLeft = PbtaUtility.convertAttr(v.attributesLeft);
				}

				if (v.moveTypes) {
					actorType.moveTypes = {};
					for (let [mtKey, mtLabel] of Object.entries(v.moveTypes)) {
						actorType.moveTypes[PbtaUtility.cleanClass(mtKey, false)] = {
							label: mtLabel,
							moves: []
						};
					}
				}

				if (v.equipmentTypes) {
					actorType.equipmentTypes = {};
					for (let [etKey, etLabel] of Object.entries(v.equipmentTypes)) {
						actorType.equipmentTypes[PbtaUtility.cleanClass(etKey, false)] = {
							label: etLabel,
							moves: []
						};
					}
				}

				if (k !== "character" && k !== "npc") {
					actorType.baseType = "character";
					if (v.baseType) {
						actorType.baseType = v.baseType;
					} else if (v.basetype) {
						actorType.baseType = v.basetype;
					}
				}

				delete v.attributesTop;
				delete v.attributesLeft;

				if (!newConfig.actorTypes) {
					newConfig.actorTypes = {};
				}
				newConfig.actorTypes[k] = actorType;
			}
		}

		// Update stored config.
		return newConfig;
	}

	static updateAttrCellTrackDisplay(attr) {
		for (let s of attr.steps) {
			if (s.isValue) {
				s.checked = s.value === attr.value;
				continue;
			}
			if (s.value > 0) {
				s.checked = (attr.positive.steps * (s.value - 1)) + s.step + 1 <= attr.positive.value;
			} else {
				s.checked = (attr.negative.steps * -(s.value + 1)) + s.step + 1 <= attr.negative.value;
			}
		}
	}

	static convertAttr(attrGroup) {
		let attrs = {};
		for (let [attrKey, attrValue] of Object.entries(attrGroup)) {
			let attr = {};

			attr.label = attrValue.label ?? this.toTitleCase(attrKey);
			attr.description = attrValue.description ?? null;
			attr.customLabel = attrValue.customLabel ?? false;
			attr.userLabel = attr.customLabel ? attr.label : false;

			if (!attrValue.type) {
				// If an object structure was used and no type was specified, it's invalid.
				if (typeof attrValue === "object") {
					continue;
				}
				// Otherwise, conver the value into the type (short syntax).
				let val = attrValue;
				attrValue = { type: val, value: "" };
			}

			if (!PBTA.attrTypes.includes(attrValue.type)) {
				continue;
			}

			switch (attrValue.type) {
			case "Number":
				attr.type = attrValue.type;
				attr.value = attrValue.default ?? 0;
				break;

			case "Clock":
				attr.type = attrValue.type;
				attr.value = attrValue.default ?? 0;
				attr.max = attrValue.max ?? 0;
				attr.steps = [];
				if (attr.max) {
					for (let i = 0; i < attr.max; i++) {
						attr.steps.push(i < attr.value);
					}
				}
				break;

			case "Xp":
				attr.type = attrValue.type;
				attr.value = attrValue.default ?? 0;
				attr.max = attrValue.max ?? 0;
				attr.steps = [];
				if (attr.max) {
					for (let i = 0; i < attr.max; i++) {
						attr.steps.push(i < attr.value);
					}
				}
				break;

			case "Resource":
				attr.type = attrValue.type;
				attr.value = attrValue.default ?? 0;
				attr.max = attrValue.max ?? 0;
				break;

			case "Text":
				attr.type = attrValue.type;
				attr.value = attrValue.default ?? "";
				break;

			case "LongText":
				attr.type = attrValue.type;
				attr.value = attrValue.default ?? "";
				break;

			case "Checkbox":
				attr.type = attrValue.type;
				attr.checkboxLabel = attrValue.checkboxLabel ?? false;
				attr.value = attrValue.default ?? false;
				break;

			case "ListMany":
				attr.type = attrValue.type;
				attr.condition = attrValue.condition ?? false;
				attr.options = PbtaUtility.getListOptions(attrValue);
				break;

			case "ListOne":
				attr.type = attrValue.type;
				attr.options = PbtaUtility.getListOptions(attrValue, true);
				attr.value = attrValue.default ?? "0";
				break;

			case "Roll":
				attr.type = attrValue.type;
				attr.value = attrValue.default ?? "";
				break;

			case "Track":
				// based on Faction Reputation of Root RPG
				attr.type = attrValue.type;
				attr.value = attrValue.default ?? 0;

				attr.negative = {
					value: attrValue.negative?.default ?? 0,
					steps: attrValue.negative?.steps ?? 3,
					max: attrValue.negative?.max ?? 3,
					label: attrValue.negative?.label,
				};
				attr.positive = {
					value: attrValue.positive?.default ?? 0,
					steps: attrValue.positive?.steps ?? 5,
					max: attrValue.positive?.max ?? 5,
					label: attrValue.positive?.label,
				};

				// Rendering helper for Track
				attr.steps = [];
				for (let i = attr.negative.max - 1; i >= 0; i--) {
					attr.steps.push({ isValue: true, label: `-${i + 1}`, value: -(i + 1) });
					for (let j = attr.negative.steps - 1; j >= 0; j--) {
						attr.steps.push({ isValue: false, step: j, value: -(i + 1) });
					}
				}
				attr.steps.push({ isValue: true, label: "+0", value: 0 });
				for (let i = 0; i < attr.positive.max; i++) {
					for (let j = 0; j < attr.positive.steps; j++) {
						attr.steps.push({ isValue: false, step: j, value: i + 1 });
					}
					attr.steps.push({ isValue: true, label: `+${i + 1}`, value: i + 1 });
				}
				// used to display the label
				attr.stepsNegative = (attr.negative.max * attr.negative.steps) + attr.negative.max;
				attr.stepsPositive = (attr.positive.max * attr.positive.steps) + attr.positive.max;

				this.updateAttrCellTrackDisplay(attr);

				break;

			default:
				break;
			}

			attrs[attrKey] = attr;
		}

		return attrs;
	}

	static applyActorTemplates(clear = false) {
		let templates = game.system.model.Actor;
		let actorTypes = Object.keys(templates);

		if (!game.pbta.sheetConfig) {
			return;
		}

		if (!game.pbta.sheetConfig.actorTypes) {
			let menu = game.settings.menus.get("pbta.sheetConfigMenu");
			let app = new menu.type();
			app.render(true);
			return false;
		}

		for (let type of actorTypes) {
			if (game.pbta.sheetConfig.actorTypes[type]) {
				let template = {};
				let v = game.pbta.sheetConfig.actorTypes[type];

				if (v.stats) {
					template.stats = v.stats;
				}
				if (v.attrTop) {
					template.attrTop = v.attrTop;
				}
				if (v.attrLeft) {
					template.attrLeft = v.attrLeft;
				}

				let orig = !clear ? duplicate(templates[type]) : {};
				templates[type] = mergeObject(orig, template);
			}
		}
	}

	static getRollFormula(defaultFormula = "2d6") {
		return game.pbta.sheetConfig.rollFormula ?? defaultFormula;
	}

	static getListOptions(attrValue, isRadio = false) {
		let options = {};
		if (attrValue.options) {
			// Handle options if provided as an array.
			if (Array.isArray(attrValue.options)) {
				attrValue.options.forEach((optV, index) => {
					if (typeof optV === "object") {
						const { label, tooltip } = optV;
						options[index] = {
							label,
							tooltip,
							value: isRadio ? optV : false
						};
					} else {
						options[index] = {
							label: optV,
							value: isRadio ? optV : false
						};
					}
				});
			} else if (typeof attrValue.options === "object") {
				// Handle options if provided as an object (keyed array).
				Object.entries(attrValue.options).forEach(([optK, optV]) => {
					if (typeof optV === "object") {
						const { label, tooltip } = optV;
						options[optK] = {
							label,
							tooltip,
							value: isRadio ? optV : false
						};
					} else {
						options[optK] = {
							label: optV,
							value: isRadio ? optV : false
						};
					}
				});
			}
			// Handle special options.
			for (let [optK, optV] of Object.entries(options)) {
				let optCount = optV.label.match(/(\|)(\d)/);
				if (optCount && optCount[2] && Number.isNumeric(optCount[2])) {
					let subOptV = {};
					for (let subOptK = 0; subOptK < optCount[2]; subOptK++) {
						subOptV[subOptK] = {
							value: isRadio ? optV.label.split("|")[0] : false
						};
					}
					options[optK].values = subOptV;
					options[optK].label = optV.label.split("|")[0];
				}
			}
		}
		return options;
	}

	static getTagList(document, type) {
		const { general = "[]", actor: actorTags = {}, item: itemTags = {} } = game.settings.get("pbta", "tagConfig") ?? {};
		const { general: moduleGeneral = "[]", actor: moduleActorTags = {}, item: moduleItemTags = {} } = game.pbta.tagConfigOverride ?? {};
		const generalTags = this.parseTags(general);
		const generalModuleTags = this.parseTags(moduleGeneral);
		const tagNames = [...generalTags, ...generalModuleTags];
		if (type === "actor") {
			const allActorTags = this.parseTags(actorTags.all);
			const typeTags = this.parseTags(actorTags?.[document.type]);

			const allModuleActorTags = this.parseTags(moduleActorTags.all);
			const moduleTypeTags = this.parseTags(moduleActorTags?.[document.type]);

			tagNames.push(...allActorTags, ...typeTags, ...allModuleActorTags, ...moduleTypeTags);
		} else if (type === "item") {
			const allItemTags = this.parseTags(itemTags.all);
			const typeTags = this.parseTags(itemTags?.[document.type]);

			const allModuleItemTags = this.parseTags(moduleItemTags.all);
			const moduleTypeTags = this.parseTags(moduleItemTags?.[document.type]);

			tagNames.push(...allItemTags, ...typeTags, ...allModuleItemTags, ...moduleTypeTags);
		}
		tagNames.sort((a, b) => {
			const aSort = a.value.toLowerCase();
			const bSort = b.value.toLowerCase();
			if (aSort < bSort) {
				return -1;
			}
			if (aSort > bSort) {
				return 1;
			}
			return 0;
		});
		return tagNames;
	}

	static parseTags(tagString) {
		if (tagString) {
			return JSON.parse(tagString);
		}
		return [];
	}
}
