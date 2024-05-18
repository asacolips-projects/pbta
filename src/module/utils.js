/**
 * Transforms any string into "sluggy" string
 * @param {string} string	The string to be transformed.
 * @param {boolean} hyphenate	The replacement character for underscores, and multiple dashes or whitespaces
 * @returns {string}
 */
export function cleanClass(string, hyphenate = true) {
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

/**
 * Validate sheetConfig settings and return errors.
 * @param {object} sheetConfig Computed sheetConfig settings.
 * @returns {Array}
 */
export function validateSheetConfig(sheetConfig) {
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
		equipmentTypes: game.i18n.localize("PBTA.Messages.sheetConfig.equipmentTypes")
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
	const actorTypes = new Set(["character", "npc", ...Object.keys(game.pbta.sheetConfig?.actorTypes || {})]);
	Object.keys(sheetConfig)
		.filter((key) => !(CONFIG.PBTA.sheetConfigs.includes(key) || game.pbta.sheetConfig?.actorTypes?.[key]))
		.forEach((key) => actorTypes.add(key));

	// Iterate through the actor types.
	for (const actorType of actorTypes) {
		// Error for missing actor type.
		if (!sheetConfig[actorType] && ["character", "npc"].includes(actorType)) {
			errors.push(`'${actorType}' ${t.actorTypeRequired}`);
			continue;
		}

		// Store this in an easier to reference variable.
		const actorConfig = sheetConfig[actorType];

		if (!actorConfig) {
			continue;
		}

		// Validate stats.
		if (actorConfig.stats) {
			if (actorConfig.stats.length > 0) {
				for (const [k, v] of actorConfig.stats) {
					if (typeof v !== "string") {
						errors.push(`${t.statString1} "${k}" ${t.statString2}`);
					}
				}
			}
		} else if ((actorType === "character" || actorConfig?.baseType === "character") && !sheetConfig.statToken) {
			// Stats are required for characters (but not for NPCs).
			errors.push(`${t.statsRequired1} '${actorType}' ${t.statsRequired2}.`);
		}

		// Validate attribute groups.
		let attrGroups = ["attributesTop", "attributesLeft"];
		for (let attrGroup of attrGroups) {
			const groupConfig = actorConfig[attrGroup];

			// If an attribute group is present, validate it.
			if (groupConfig) {
				// Groups must be objects.
				if (typeof groupConfig !== "object") {
					errors.push(`'${actorType}.${attrGroup}' ${t.groupAttributes}`);
				} else {
					// Iterate through each attribute.
					Object.entries(groupConfig).forEach(([attr, attrValue]) => {
						// Confirm the attribute type is valid.
						let attrType = typeof attrValue === "object" && attrValue.type ? attrValue.type : attrValue;
						if (!CONFIG.PBTA.attrTypes.includes(attrType)) {
							errors.push(`${t.attribute} '${actorType}.${attrGroup}.${attr}' ${t.attributeType} ${CONFIG.PBTA.attrTypes.join(", ")}.`);
						}

						if (typeof attrType === "object") {
							errors.push(`${t.attribute} '${actorType}.${attrGroup}.${attr}' ${t.attributeTypeNull}`);
							return; // Continue to the next iteration.
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
					});
				}
			}
		}

		// Validate that the movetypes are included
		if (foundry.utils.isEmpty(actorConfig.moveTypes)) {
			errors.push(`'${actorType}.moveTypes' ${t.moveTypes}`);
		}

		// Validate that the movetypes are included
		if (foundry.utils.isEmpty(actorConfig.equipmentTypes)) {
			errors.push(`'${actorType}.equipmentTypes' ${t.equipmentTypes}`);
		}
	}

	// Return the array of errors for output.
	return errors;
}

/**
 * Parses a TOML string and returns it
 * @param {string} tomlString
 * @returns {object}
 */
export function parseTomlString(tomlString) {
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
			errors = validateSheetConfig(computed);
		}
	} else {
		// If there's no TOML string, report an error.
		errors = [game.i18n.localize("PBTA.Messages.sheetConfig.noConfig")];
	}

	// If there are errors, output them.
	if (errors.length > 0) {
		for (let error of errors) {
			ui.notifications.error(error, { permanent: true });
		}
		throw new Error(errors.join("\r\n"));
	}

	return computed;
}

/**
 * Validades the given Sheet Config.
 * @param {object} sheetConfig
 * @returns {object}
 */
export function convertSheetConfig(sheetConfig) {
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
					modifier: v.modifier ?? 0
				};
			} else {
				newConfig.statToggle = {
					label: v,
					modifier: 0
				};
			}
		} else if (k === "statToken") {
			if (!v) {
				newConfig.statToken = false;
			} else if (typeof v === "object") {
				newConfig.statToken = {
					default: v.default ?? 0,
					max: v.max ?? 1,
					min: v.min ?? 0
				};
			} else {
				newConfig.statToken = {
					default: 0,
					max: v,
					min: 0
				};
			}
		} else if (k === "statShifting") {
			const img = "systems/pbta/assets/icons/svg/back-forth.svg";
			const statLabel = game.i18n.localize("PBTA.Stat.label");
			const statsLabel = game.i18n.localize("PBTA.Stat.labelPl");
			const label = game.i18n.format("PBTA.Stat.Shifting.label", { stat: statLabel });
			if (typeof v === "object") {
				newConfig.statShifting = {
					img: v.img ?? img,
					label: v.label || label,
					value: v.value && !isNaN(v.value) ? Math.abs(v.value) : 1,
					labels: {
						stat: v.stat || statLabel,
						stats: v.stats || statsLabel
					}
				};
			} else {
				newConfig.statShifting = {
					img,
					label,
					value: 1,
					labels: {
						stat: statLabel,
						stats: statsLabel
					}
				};
			}
		} else if (k === "statClock") {
			newConfig.statClock = v;
		} else if (k === "rollResults") {
			newConfig.rollResults = {};
			// Set result ranges.
			for (let [rollKey, rollSetting] of Object.entries(v)) {
				if (rollSetting.range && typeof rollSetting.range === "string") {
					// Split the result range into an array.
					let range = rollSetting.range.split(/[-+]/g);
					if (range.length === 2 && range[0] !== "") {
						// Get the start and end numbers. Start should always be numeric,
						// e.g. 6- rather than -6.
						let start = Number(range[0]);
						let end = range[1] !== "" ? Number(range[1]) : null;
						let rollResult = {};

						// If there's only one digit, assume it's N+ or N-.
						if (end === null) {
							rollResult = {
								start: rollSetting.range.includes("-") ? -Infinity : start,
								end: rollSetting.range.includes("+") ? Infinity : start,
								label: rollSetting.label
							};
						} else {
							// Otherwise, set the full range.
							rollResult = {
								start,
								end,
								label: rollSetting.label
							};
						}

						// Update the sheet config with this result range.
						newConfig.rollResults[rollKey] = rollResult;
					}
				}
			}
		} else if (k === "minMod") {
			newConfig.minMod = v;

		} else if (k === "maxMod") {
			newConfig.maxMod = v;
		// eslint-disable-next-line max-len
		} else if (v.label || v.description || v.stats || v.attributesTop || v.attributesLeft || v.moveTypes || v.equipmentTypes) {
			// Actors
			let actorType = {};
			if (v.label) {
				actorType.label = game.i18n.localize(v.label);
			}

			if (v.description) {
				actorType.details = {};
				if (typeof v.description === "string") {
					actorType.details[v.description] = {
						label: v.description,
						value: ""
					};
				} else if (typeof v.description === "object") {
					Object.entries(v.description).forEach(([key, value]) => {
						actorType.details[key] = foundry.utils.mergeObject({
							label: key,
							value: ""
						}, { ...value });
					});
				}
			} else {
				actorType.details = {
					biography: {
						label: game.i18n.localize("PBTA.Biography"),
						value: ""
					}
				};
			}

			if (v.stats) {
				actorType.stats = {};
				for (let [statKey, statLabel] of Object.entries(v.stats)) {
					let cleanKey = cleanClass(statKey, false);
					if (["ask", "formula", "prompt"].includes(cleanKey)) {
						continue;
					}

					actorType.stats[cleanKey] = {
						label: statLabel,
						value: 0
					};

					if (newConfig.statClock) {
						actorType.stats[cleanKey].steps = {
							value: 0,
							max: newConfig.statClock
						};
					}
				}
				if (newConfig.statToken && !("token" in actorType.stats)) {
					actorType.stats.token = {
						label: "Token",
						value: newConfig.statToken.default
					};
				}
			}

			if (v.attributesTop) {
				actorType.attrTop = convertAttr(v.attributesTop);
			}
			if (v.attributesLeft) {
				actorType.attrLeft = convertAttr(v.attributesLeft);
			}

			Object.defineProperty(actorType, "attributes", {
				get() {
					return {
						...actorType.attrTop,
						...actorType.attrLeft
					};
				}
			});

			if (v.moveTypes) {
				actorType.moveTypes = {};
				for (let [mtKey, mtValue] of Object.entries(v.moveTypes)) {
					if (typeof mtValue === "string") {
						actorType.moveTypes[cleanClass(mtKey, false)] = {
							label: mtValue,
							moves: []
						};
					} else {
						const { label, playbook = false, creation = false } = mtValue;
						actorType.moveTypes[cleanClass(mtKey, false)] = {
							label,
							playbook,
							creation,
							moves: [] // @todo add support for moves
						};
					}
				}
			}

			if (v.equipmentTypes) {
				actorType.equipmentTypes = {};
				for (let [etKey, etLabel] of Object.entries(v.equipmentTypes)) {
					actorType.equipmentTypes[cleanClass(etKey, false)] = {
						label: etLabel,
						moves: []
					};
				}
			}

			if (k !== "character" && k !== "npc") {
				actorType.baseType = v.baseType ?? "character";
			}

			if (!newConfig.actorTypes) {
				newConfig.actorTypes = {};
			}
			newConfig.actorTypes[k] = actorType;
		}
	}

	// Update stored config.
	return newConfig;
}

/**
 * Updates a Track's display.
 * @param {object} attr
 */
export function updateAttrCellTrackDisplay(attr) {
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

/**
 * Validades an Attribute Group.
 * @param {object} attrGroup
 * @returns {object}
 */
export function convertAttr(attrGroup) {
	let attrs = {};
	for (let [attrKey, attrValue] of Object.entries(attrGroup)) {
		let attr = {};

		attr.label = attrValue.label ?? attrKey.titleCase();
		attr.description = attrValue.description ?? null;
		attr.customLabel = attrValue.customLabel ?? false;
		attr.userLabel = attr.customLabel ? attr.label : false;
		attr.playbook = attrValue.playbook ?? null;
		attr.limited = attrValue.limited ?? false;

		if (!attrValue.type) {
			// If an object structure was used and no type was specified, it's invalid.
			if (typeof attrValue === "object") {
				continue;
			}
			// Otherwise, conver the value into the type (short syntax).
			let val = attrValue;
			attrValue = { type: val, value: "" };
		}

		if (!CONFIG.PBTA.attrTypes.includes(attrValue.type)) {
			continue;
		}

		attr.type = attrValue.type;
		switch (attrValue.type) {
			case "Number":
				attr.value = attrValue.default ?? 0;
				break;

			case "Clock":
			case "Xp":
			case "Resource":
				attr.value = attrValue.default ?? 0;
				attr.max = attrValue.max ?? 1;
				break;

			case "Text":
			case "LongText":
			case "Roll":
				attr.value = attrValue.default ?? "";
				break;

			case "Checkbox":
				attr.checkboxLabel = attrValue.checkboxLabel ?? false;
				attr.value = attrValue.default ?? false;
				break;

			case "ListMany":
				attr.condition = attrValue.condition ?? false;
				attr.sort = attrValue.sort ?? false;
				attr.options = getListOptions(attrValue);
				break;

			case "ListOne":
				attr.options = getListOptions(attrValue, true);
				attr.sort = attrValue.sort ?? false;
				attr.value = attrValue.default ?? "0";
				break;

			case "Track":
				// based on Faction Reputation of Root RPG
				attr.value = attrValue.default ?? 0;

				attr.negative = {
					value: attrValue.negative?.default ?? 0,
					steps: attrValue.negative?.steps ?? 3,
					max: attrValue.negative?.max ?? 3,
					label: attrValue.negative?.label
				};
				attr.positive = {
					value: attrValue.positive?.default ?? 0,
					steps: attrValue.positive?.steps ?? 5,
					max: attrValue.positive?.max ?? 5,
					label: attrValue.positive?.label
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

				updateAttrCellTrackDisplay(attr);

				break;

			default:
				break;
		}

		attrs[attrKey] = attr;
	}

	return attrs;
}

/**
 * Applies the Sheet Config's actor's stats and attributes to the system's actor templates.
 * @param {boolean} clear	Sets if the system's templates should be merged or replaced.
 */
export function applyActorTemplates(clear = false) {
	let templates = game.model.Actor;
	let actorTypes = Object.keys(templates);

	if (!game.pbta.sheetConfig) {
		return;
	}

	if (!game.pbta.sheetConfig.actorTypes) {
		let menu = game.settings.menus.get("pbta.sheetConfigMenu");
		let app = new menu.type();
		app.render(true);
		return;
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
			if (v.details) {
				template.details = v.details;
			} else {
				template.details = {
					biography: { label: game.i18n.localize("PBTA.Biography"), value: "" }
				};
			}

			let orig = !clear ? foundry.utils.duplicate(templates[type]) : {};
			templates[type] = foundry.utils.mergeObject(orig, template);
		}
	}
}

/**
 * Generates a list of checkboxes.
 * @param {object} attrValue
 * @param {boolean} isRadio	Sets if the checkboxes are radio buttons.
 * @returns {object}
 */
export function getListOptions(attrValue, isRadio = false) {
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
			const separatorRe = /(\|)\s*(\d)/;
			if (separatorRe.test(optV.label)) {
				const optCount = optV.label.match(separatorRe);
				const label = optV.label.split("|")[0].trim();

				const subOptV = {};
				for (let subOptK = 0; subOptK < optCount[2]; subOptK++) {
					subOptV[subOptK] = {
						value: isRadio ? label : false
					};
				}
				options[optK] = {
					values: subOptV,
					label
				};
			}
		}
	}
	return options;
}

/**
 * Retrieve deprecated item/compendium tags.
 *
 * Retrieves an array of tags created as items or compendium entries.
 * This will be used to aid as a deprecation period for item/compendium
 * tags until they're migrated to the new tags setting.
 *
 * @returns {Array}
 *   Array of item tags.
 */
export function getDeprecatedTagList() {
	// Build the tags list.
	let tags = game.items.filter((item) => item.type === "tag").map((item) => {
		return item.name;
	});
	for (let c of game.packs) {
		if (c.metadata.type && c.metadata.type === "Item" && c.metadata.name === "tags") {
			let items = c?.index ? c.index.map((indexedItem) => {
				return indexedItem.name;
			}) : [];
			tags = tags.concat(items);
		}
	}
	// Reduce duplicates.
	let tagNames = [];
	for (let tag of tags) {
		if (typeof tag === "string") {
			let tagName = tag.toLowerCase();
			if (tagNames.includes(tagName) === false) {
				tagNames.push({ value: tagName });
			}
		}
	}

	return tagNames;
}

/**
 * Generates a list of tags.
 *
 * Reads both the user-defined tags and module-defined tags and
 * merges them into groups related to the given document's Collection Name
 * and its type, along with the general tags.
 *
 * @param {*} document	A Document, such as an Actor or Item.
 * @returns {object[]}
 */
export function getTagList(document) {
	if (game.pbta.tagList) {
		// @todo this will cause conflicts once Actor Tags are supported
		// should refactor the whole thing to create two lists on CONFIG.PBTA.tags
		// and have the specific tagify functions get from them instead
		return game.pbta.tagList;
	}
	const { general = "[]", actor: actorTags = {}, item: itemTags = {} } = game.settings.get("pbta", "tagConfig") ?? {};
	const { general: moduleGeneral = "[]", actor: moduleActorTags = {}, item: moduleItemTags = {} } = game.pbta.tagConfigOverride ?? {};
	const generalTags = parseTags(general);
	const generalModuleTags = parseTags(moduleGeneral);
	// @todo remove deprecated tags in a future version.
	const deprecatedTags = getDeprecatedTagList();
	const tagNames = [...generalTags, ...generalModuleTags, ...deprecatedTags];
	if (document.collectionName === "actors") {
		const allActorTags = parseTags(actorTags.all);
		const typeTags = parseTags(actorTags?.[document.type]);

		const allModuleActorTags = parseTags(moduleActorTags.all);
		const moduleTypeTags = parseTags(moduleActorTags?.[document.type]);

		tagNames.push(...allActorTags, ...typeTags, ...allModuleActorTags, ...moduleTypeTags);
	} else if (document.collectionName === "items") {
		const allItemTags = parseTags(itemTags.all);
		const typeTags = parseTags(itemTags?.[document.type]);

		const allModuleItemTags = parseTags(moduleItemTags.all);
		const moduleTypeTags = parseTags(moduleItemTags?.[document.type]);

		tagNames.push(...allItemTags, ...typeTags, ...allModuleItemTags, ...moduleTypeTags);
	}
	tagNames.sort((a, b) => a.value.localeCompare(b.value, undefined, { sensitivity: "base" }));
	game.pbta.tagList = tagNames;
	return tagNames;
}

/**
 * Parses a string formatted as a JSON object.
 * @param {string} tagString
 * @returns {object[]}
 */
export function parseTags(tagString) {
	if (tagString) {
		return JSON.parse(tagString);
	}
	return [];
}

export class TagHandler {
	/**
	 * Adding a tag template that puts the description in the tooltip.
	 * If the description doesn't exist, there is not tool-tip
	 * @param {any} tagData
	 * @returns {string} an HTML template for the tag
	 */
	static tagTemplate(tagData) {
		return `
			<tag data-tooltip="${game.i18n.localize(tagData.description) ?? ""}"
					class="tagify__tag ${tagData.class ?? ""}" ${this.getAttributes(tagData)}>
				<x title='' class='tagify__tag__removeBtn' role='button' aria-label='remove tag'></x>
				<div>
					<span class='tagify__tag-text'>${game.i18n.localize(tagData.value)}</span>
				</div>
			</tag>
		`;
	}

	/**
	 * Allows User input of tags with descriptions in
	 * the form of "tag name"|"tag description"
	 * @param {any} tagData
	 */
	static transformTag(tagData) {
		let parts = tagData.value.split(/\|/);
		let value = parts[0].trim();
		let description = parts[1]?.replace(/\|/, "").trim();

		tagData.value = value;
		tagData.description = description || tagData.description;
	}

	static onEdit(tagify, { tag, data }) {
		let output = data.value;
		if (data.description) output += ` | ${data.description}`;
		tagify.setTagTextNode(tag, output);
	}

	static get config() {
		return {
			a11y: {
				focusableTags: true
			},
			templates: {
				tag: this.tagTemplate   // <- Add a custom template so descriptions show in a tooltip
			},
			transformTag: this.transformTag
		};
	}
}

/**
 * Retrieves a list of Playbooks in the world and compendiums
 * and returns them as an array of names or of documents.
 */
export async function getPlaybooks() {
	// Retrieve custom or overridden playbooks.
	let playbooks = game.items.filter((item) => item.type === "playbook");

	// Retrieve compendium playbooks and merge them in.
	for (let c of game.packs) {
		if (c.metadata.type !== "Item") continue;
		playbooks = playbooks.concat(await c.getDocuments({ type: "playbook" }));
	}

	const sortedPlaybooks = playbooks.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
	CONFIG.PBTA.playbooks = sortedPlaybooks
		.map((p) => {
			return {
				name: p.name,
				slug: p.system.slug || p.name.slugify(),
				uuid: p.uuid,
				actorType: p.system.actorType
			};
		});
}

/**
 * Returns a list of names of the playbooks listed under CONFIG.PBTA.playbooks.
 * @returns {string[]}
 */
export function getPlaybookLabels() {
	const playbooksLabels = Array.from(new Set(CONFIG.PBTA.playbooks.map((playbook) => playbook.name)));
	return playbooksLabels.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

/**
 * Updates every actor in the world with changes from a
 * new Sheet Config.
 * @param {object} newConfig
 * @returns {Promise<boolean>}
 */
export async function updateActors(newConfig) {
	let success = true;
	let newTokenConfig = {
		character: {},
		npc: {}
	};

	// Get all active actors.
	let documents = {
		character: Object.keys(newConfig.character).length > 0 ? game.actors.filter((a) => a.type === "character") : [],
		npc: Object.keys(newConfig.npc).length > 0 ? game.actors.filter((a) => a.type === "npc") : []
	};

	// Determine if we need to query other actors.
	for (let actorType of Object.keys(newConfig)) {
		if (actorType === "character" || actorType === "npc") {
			continue;
		}
		if (!newTokenConfig[actorType]) {
			newTokenConfig[actorType] = {};
		}
		if (!documents[actorType]) {
			let actors = Object.keys(newConfig[actorType]).length > 0 ? game.actors.filter((a) => a.type === "other" && a.system?.customType === actorType) : [];
			documents[actorType] = actors;
		}
	}

	let updates = [];

	for (let [actorType, actors] of Object.entries(documents)) {
		// Tokens won't need the full update, we only need to do updates for
		// deleted keys. All other updates can be inferred from the base actor.
		for (let [cfgK, cfgV] of Object.entries(newConfig[actorType])) {
			if (cfgK.includes("-=")) {
				newTokenConfig[actorType][`actorData.${cfgK}`] = cfgV;
			}
		}

		// Build the updates array for actors.
		for (let actor of actors) {
			let update = foundry.utils.duplicate(newConfig[actorType]);
			update._id = actor.id;
			updates.push(update);
		}
	}

	// Apply updates to actors.
	if (updates.length > 0) {
		try {
			await Actor.updateDocuments(updates);
			success = true;
		} catch(error) {
			console.error(error);
			success = false;
		}
	}

	// We also need to handle any attributes that were removed on tokens.
	// Otherwise, we could have removed attributes orphaned on synthetic actors.

	// Begin by iterating through all scenes.
	game.scenes.forEach(async (s) => {
		// Build the token updates array for this scene and load its tokens.
		let tokenUpdates = [];
		let tokens = s.getEmbeddedCollection("Token");
		// If there are tokens, we need to build updates.
		if (tokens.length > 0) {
			// Iterate through all of the tokens.
			tokens.forEach((t) => {
				// We only need to handle updates if this is an unlinked token. If the
				// token is linked, it will have been handled automatically by the
				// actor updates in the previous step.
				if (!t.actorLink) {
					// We need to load the actor to get the actor type.
					let prototypeActor = game.actors.get(t.actorId);
					if (prototypeActor) {
						const sheetType = prototypeActor?.sheetType;
						// Build the update and append to the scene's update array.
						let tokenUpdate = foundry.utils.duplicate(newTokenConfig[sheetType]);
						tokenUpdate._id = t.id;
						tokenUpdates.push(tokenUpdate);
					}
				}
			});
		}
		// If this scene has token updates, we need to apply them to the
		// embedded token documents.
		if (tokenUpdates.length > 0) {
			try {
				await s.updateEmbeddedDocuments("Token", tokenUpdates);
			} catch(error) {
				console.error(error);
			}
		}
	});

	// Return whether or not the function was successful (which will allow
	// the dialog to proceed or fail).
	return success;
}

/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @returns {Promise}
 */
export async function preloadHandlebarsTemplates() {

	// Define template paths to load
	const templatePaths = [
		// Actor partials
		"systems/pbta/templates/actors/parts/actor-attributes.hbs",
		"systems/pbta/templates/actors/parts/actor-description.hbs",
		"systems/pbta/templates/actors/parts/actor-header.hbs",
		"systems/pbta/templates/actors/parts/actor-inventory.hbs",
		"systems/pbta/templates/actors/parts/actor-movelist.hbs",
		"systems/pbta/templates/actors/parts/actor-moves.hbs",
		"systems/pbta/templates/actors/parts/actor-stats.hbs",

		// Item partials
		"systems/pbta/templates/items/parts/move-description.hbs",
		"systems/pbta/templates/items/parts/playbook-attributes.hbs",
		"systems/pbta/templates/items/parts/playbook-choicesets.hbs",

		// Chat Cards
		"systems/pbta/templates/chat/stat-shift.hbs",

		// Dialog partials
		"systems/pbta/templates/dialog/choice-dialog.hbs"
	];

	const paths = {};
	for (const path of templatePaths) {
		paths[path.replace(".hbs", ".html")] = path;
		paths[`pbta.${path.split("/").pop()
			.replace(".hbs", "")}`] = path;
	}

	// Load the template parts
	return loadTemplates(paths);
}

/**
 * Register custom Handlebars helpers.
 */
export function registerHandlebarsHelpers() {
	Handlebars.registerHelper("pbtaTags", function (tagsInput) {
		const tags = JSON.parse(tagsInput);
		const tagList = tags.map((tag) => `<div class="tag">${tag.value}</div>`).join("");
		const output = `<div class="tags">${tagList}</div>`;
		return output;
	});

	/**
	 * Similar to Foundry's eq, except "1" == 1 is truthy.
	 */
	Handlebars.registerHelper("softEq", function (arg1, arg2, options) {
		// eslint-disable-next-line eqeqeq
		return (arg1 == arg2);
	});

	/**
	 * Returns length of Object's keys.
	 */
	Handlebars.registerHelper("objLen", function (json) {
		if (!json) return 0;
		return Object.keys(json).length;
	});

	Handlebars.registerHelper("getLabel", function (obj, key) {
		const result = obj[key]?.label || obj[key] || key;
		return result.length > 0 ? result : key;
	});

	Handlebars.registerHelper("getValue", function (obj, key) {
		const result = obj?.[key]?.value || obj?.[key] || "";
		return result.length > 0 ? result : null;
	});

	Handlebars.registerHelper("times", function (n, options) {
		let accum = "";
		let data;
		if (options.data) {
			data = Handlebars.createFrame(options.data);
		}
		for (let i = 0; i < n; ++i) {
			if (data) {
				data.index = i;
			}
			accum += options.fn(i, { data: data });
		}
		return accum;
	});
}
