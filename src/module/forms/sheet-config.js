import { codeMirrorAddToml } from "./codemirror.toml.js";

export class PbtaSettingsConfigDialog extends FormApplication {
	constructor(...args) {
		super(...args);
		if (this.sheetOverriden) {
			this.options.classes.push("sheetOverriden");
			this.options.width = this.position.height = "auto";
			this.options.resizable = false;
		}
	}

	/** @override */
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			title: game.i18n.localize("PBTA.Settings.sheetConfig.title"),
			id: "pbta-sheet-config",
			classes: ["pbta", "pbta-sheet-config"],
			template: "systems/pbta/templates/dialog/sheet-config.html",
			width: 720,
			height: 800,
			resizable: true,
			closeOnSubmit: true
		});
	}

	/* -------------------------------------------- */

	get sheetOverriden() {
		return game.settings.get("pbta", "sheetConfigOverride");
	}

	/* -------------------------------------------- */

	/** @override */
	async getData(options) {
		const sheetConfig = game.settings.get("pbta", "sheetConfig") || {};
		return {
			...foundry.utils.deepClone(sheetConfig),
			sheetConfigOverride: this.sheetOverriden,
			tomlString: sheetConfig.tomlString || ""
		};
	}

	/* -------------------------------------------- */
	/*  Event Listeners and Handlers                */
	/* -------------------------------------------- */

	/** @override */
	activateListeners(html) {
		super.activateListeners(html);
		html.find('button[name="help"]').click((ev) => {
			event.preventDefault();
			window.open("https://asacolips.gitbook.io/pbta-system/", "pbtaHelp", "width=1032,height=720");
		});
		html.find('button[name="reset"]').click(this._onResetDefaults.bind(this));
		if (!this.sheetOverriden) {
			// Load toml syntax. This is a failsafe in case other modules that use
			// CodeMirror (such as Custom CSS Rules) are enabled.
			if (!CodeMirror.modes.toml) {
				codeMirrorAddToml();
			}

			// Enable the CodeMirror code editor.
			this.codeEditor = CodeMirror.fromTextArea(html.find(".pbta-sheet-config")[0], {
				mode: "toml",
				indentUnit: 4,
				smartIndent: true,
				indentWithTabs: false,
				tabSize: 2,
				lineNumbers: true,
				inputStyle: "contenteditable",
				autofocus: true,
				theme: "material-palenight"
			});
		}
	}

	/**
	 * Handles retrieving data from the form.
	 *
	 * @override
	 *
	 * @param {Array} args All arguments passed to this method, which will be forwarded to super
	 * @returns {object} The form data
	 * @memberof SettingsForm
	 */
	_getSubmitData(...args) {
		this.codeEditor.save();
		return super._getSubmitData(...args);
	}

	/* -------------------------------------------- */

	/**
	 * Handle button click to reset default settings
	 * @param {event} event   The initial button click event
	 */
	async _onResetDefaults(event) {
		event.preventDefault();
		await game.settings.set("pbta", "sheetConfig", {});
		ui.notifications.info(game.i18n.localize("PBTA.Messages.sheetConfig.reset"));
		this.render();
	}

	async close(options) {
		super.close(options);
		if (typeof this._submitting !== "undefined") {
			window.location.reload();
		}
	}

	/* -------------------------------------------- */

	/** @override */
	async _updateObject(event, formData) {
		let computed = {};

		computed = game.pbta.utils.parseTomlString(formData.tomlString) ?? null;
		if (computed) {
			let confirm = true;
			if (game.pbta.sheetConfig?.actorTypes?.character && game.pbta.sheetConfig?.actorTypes?.npc) {
				confirm = await this.diffSheetConfig(computed);
			}
			if (!confirm) {
				throw new Error("Cancelled");
			}
			if (computed) {
				formData.computed = computed;
			}
			await game.settings.set("pbta", "sheetConfig", formData);
		}
	}

	async diffSheetConfig(sheetConfig) {
		if (!game.pbta.sheetConfig) {
			return;
		}

		let currentConfig = game.pbta.sheetConfig;
		let duplicateConfig = foundry.utils.duplicate(sheetConfig);
		let newConfig = game.pbta.utils.convertSheetConfig(duplicateConfig);

		let configDiff = {
			add: [],
			del: [],
			max: [],
			softType: [],
			hardType: [],
			safe: [],
			options: [],
			values: []
		};
		let updatesDiff = {
			character: {},
			npc: {}
		};
		let actorTypes = ["character", "npc"];
		if (game.pbta.sheetConfig?.actorTypes) {
			for (let actorType of Object.keys(game.pbta.sheetConfig.actorTypes)) {
				if (!actorTypes.includes(actorType)) {
					actorTypes.push(actorType);
				}
				if (!updatesDiff[actorType]) {
					updatesDiff[actorType] = {};
				}
			}
		}
		let attrGroups = ["details", "stats", "attributes", "attrLeft", "attrTop", "moveTypes", "equipmentTypes"];

		for (let actorType of actorTypes) {
			// Handle deleting custom actor types.
			if (typeof newConfig?.actorTypes[actorType] === "undefined" || !newConfig.actorTypes[actorType]) {
				configDiff.del.push(`${actorType}`);
				continue;
			}
			// Handle baseType on custom actor types.
			if (newConfig.actorTypes[actorType].baseType) {
				if (newConfig.actorTypes[actorType].baseType !== currentConfig.actorTypes[actorType].baseType) {
					// This is only stored in the sheetConfig and not on actor's directly,
					// so we just need to notify the user that a change will be made.
					configDiff.hardType.push(`${actorType}.baseType`);
				}
			}
			// Handle attribute groups.
			for (let attrGroup of attrGroups) {
				let newGroup = newConfig.actorTypes[actorType][attrGroup];
				let oldGroup = currentConfig.actorTypes[actorType][attrGroup];

				if (!oldGroup && newGroup) {
					configDiff.add.push(`${actorType}.${attrGroup}`);
					updatesDiff[actorType][`system.${attrGroup}`] = newGroup;
					continue;
				} else if (oldGroup && !newGroup) {
					configDiff.del.push(`${actorType}.${attrGroup}`);
					updatesDiff[actorType][`system.-=${attrGroup}`] = null;
					continue;
				}
				if (!newGroup || !oldGroup) continue;

				for (let attr of Object.keys(newGroup)) {
					if (!oldGroup[attr]) {
						configDiff.add.push(`${actorType}.${attrGroup}.${attr}`);
						updatesDiff[actorType][`system.${attrGroup}.${attr}`] = newGroup[attr];
					} else {
						const cosmetic = ["label", "customLabel", "description", "playbook", "limited"];
						cosmetic.forEach((v) => {
							const isValid = !foundry.utils.isEmpty(newGroup[attr][v]);
							if (isValid && newGroup[attr][v] !== oldGroup[attr][v]) {
								configDiff.safe.push(`${actorType}.${attrGroup}.${attr}.${v}`);
								updatesDiff[actorType][`system.${attrGroup}.${attr}.${v}`] = newGroup[attr][v];
							}
						});
						// Handle updating ListOne values.
						if (
							!foundry.utils.isEmpty(newGroup[attr].value)
							&& newGroup[attr].value !== oldGroup[attr].value
						) {
							configDiff.values.push(`${actorType}.${attrGroup}.${attr}.value`);
							updatesDiff[actorType][`system.${attrGroup}.${attr}.value`] = newGroup[attr].value;
						}
					}
				}
				for (let attr of Object.keys(oldGroup)) {
					if (attr === "ask" || attr === "prompt" || attr === "formula") {
						continue;
					}

					if (!newGroup[attr]) {
						configDiff.del.push(`${actorType}.${attrGroup}.${attr}`);
						updatesDiff[actorType][`system.${attrGroup}.-=${attr}`] = null;
					} else {
						// Handle updating max values.
						if (newGroup[attr].max && oldGroup[attr].max) {
							if (newGroup[attr].max !== oldGroup[attr].max) {
								configDiff.max.push(`${actorType}.${attrGroup}.${attr}`);
								updatesDiff[actorType][`system.${attrGroup}.${attr}.max`] = newGroup[attr].max;
								updatesDiff[actorType][`system.${attrGroup}.${attr}.value`] = newGroup[attr].default ?? 0;
							}
						}
						// Handle type changes.
						if (newGroup[attr].type && oldGroup[attr].type) {
							let newType = newGroup[attr].type;
							let oldType = oldGroup[attr].type;
							if (newType !== oldType) {
								let resourceTypes = [
									"Resource",
									"Clock",
									"Xp"
								];

								let singleTypes = [
									"Text",
									"LongText",
									"Number"
								];

								if (
									(resourceTypes.includes(newType) && resourceTypes.includes(oldType) && oldType !== "Resource")
									|| (singleTypes.includes(newType) && singleTypes.includes(oldType) && newType !== "Number")
								) {
									configDiff.softType.push(`${actorType}.${attrGroup}.${attr}`);
									updatesDiff[actorType][`system.${attrGroup}.${attr}.type`] = newGroup[attr].type;
								} else {
									configDiff.hardType.push(`${actorType}.${attrGroup}.${attr}`);
									updatesDiff[actorType][`system.${attrGroup}.${attr}`] = newGroup[attr];
								}
							} else if (["ListOne", "ListMany"].includes(newType)) {
								if (newType === "ListMany") {
									// Handle diffing condition changes.
									if (
										(newGroup[attr]?.condition || oldGroup[attr]?.condition)
										&& (newGroup[attr]?.condition !== oldGroup[attr]?.condition)
									) {
										configDiff.softType.push(`${actorType}.${attrGroup}.${attr}`);
										updatesDiff[actorType][`system.${attrGroup}.${attr}.condition`] = newGroup[attr]?.condition ?? false;
									}
								}

								// Handle diffing options.
								if (newGroup[attr]?.options || oldGroup[attr]?.options) {
									if (this.optionsAreDifferent(newGroup[attr]?.options, oldGroup[attr]?.options)) {
										// Remove values from options so that they're not unset on existing actors.
										if (newGroup[attr]?.options) {
											for (let optV of Object.values(newGroup[attr].options)) {
												if (typeof optV.value !== "undefined") {
													delete optV.value;
												}
											}
										}
										// Create the options diff.
										configDiff.options.push(`${actorType}.${attrGroup}.${attr}`);
										updatesDiff[actorType][`system.${attrGroup}.${attr}.options`] = newGroup[attr]?.options ?? [];

										const oldClone = foundry.utils.duplicate(oldGroup);
										for (let optK of Object.keys(newGroup[attr].options)) {
											delete oldClone[attr]?.options[optK];
										}
										for (let optK of Object.keys(oldClone[attr]?.options)) {
											configDiff.del.push(`${actorType}.${attrGroup}.${attr}.options.${optK}`);
											updatesDiff[actorType][`system.${attrGroup}.${attr}.options`][`-=${optK}`] = null;
										}
									}
								}
								if (newGroup[attr]?.sort !== oldGroup[attr]?.sort) {
									configDiff.safe.push(`${actorType}.${attrGroup}.${attr}.sort`);
									updatesDiff[actorType][`system.${attrGroup}.${attr}.sort`] = newGroup[attr]?.sort ?? false;
								}
							} else if (newType === "Track") {
								const { positive: oldPositive, negative: oldNegative } = oldGroup[attr];
								const { positive: newPositive, negative: newNegative } = newGroup[attr];
								if (newPositive?.label && newPositive.label !== oldPositive?.label) {
									configDiff.safe.push(`${actorType}.${attrGroup}.${attr}.positive.label`);
									updatesDiff[actorType][`system.${attrGroup}.${attr}.positive.label`] = newPositive.label;
								}

								if (newNegative?.label && newNegative.label !== oldNegative?.label) {
									configDiff.safe.push(`${actorType}.${attrGroup}.${attr}.negative.label`);
									updatesDiff[actorType][`system.${attrGroup}.${attr}.negative.label`] = newNegative.label;
								}

								if ((newPositive.max !== oldPositive?.max)
									|| (newPositive.steps !== oldPositive?.steps)
									|| (newNegative.max !== oldNegative?.max)
									|| (newNegative.steps !== oldNegative?.steps)) {

									configDiff.max.push(`${actorType}.${attrGroup}.${attr}`);

									updatesDiff[actorType][`system.${attrGroup}.${attr}.negative.max`] = newNegative.max;
									updatesDiff[actorType][`system.${attrGroup}.${attr}.negative.steps`] = newNegative.steps;
									updatesDiff[actorType][`system.${attrGroup}.${attr}.negative.value`] = newNegative.value;
									updatesDiff[actorType][`system.${attrGroup}.${attr}.positive.max`] = newPositive.max;
									updatesDiff[actorType][`system.${attrGroup}.${attr}.positive.steps`] = newPositive.steps;
									updatesDiff[actorType][`system.${attrGroup}.${attr}.positive.value`] = newPositive.value;
									updatesDiff[actorType][`system.${attrGroup}.${attr}.value`] = newGroup[attr].value ?? 0;
									updatesDiff[actorType][`system.${attrGroup}.${attr}.steps`] = newGroup[attr].steps;
								}
							}
						}
					}
				}
			}
		}

		const hasAdditions = configDiff.add.length > 0;
		const hasDeletions = configDiff.del.length > 0;
		const hasMax = configDiff.max.length > 0;
		const hasSoftType = configDiff.softType.length > 0;
		const hasHardType = configDiff.hardType.length > 0;
		const hasSafe = configDiff.safe.length > 0;
		const hasOptions = configDiff.options.length > 0;
		const hasDeletedValues = configDiff.values.length > 0;

		const t = {
			confirmChanges: game.i18n.localize("PBTA.Settings.sheetConfig.confirmChanges"),
			confirm: game.i18n.localize("PBTA.Settings.sheetConfig.confirm"),
			confirmUpdate: game.i18n.localize("PBTA.Settings.sheetConfig.confirmUpdate"),
			cancel: game.i18n.localize("PBTA.Settings.sheetConfig.cancel"),
			additions: game.i18n.localize("PBTA.Settings.sheetConfig.additions"),
			deletions: game.i18n.localize("PBTA.Settings.sheetConfig.deletions"),
			maxValue: game.i18n.localize("PBTA.Settings.sheetConfig.maxValue"),
			type: game.i18n.localize("PBTA.Settings.sheetConfig.type"),
			typeReset: game.i18n.localize("PBTA.Settings.sheetConfig.typeReset"),
			cosmetic: game.i18n.localize("PBTA.Settings.sheetConfig.cosmetic"),
			options: game.i18n.localize("PBTA.Settings.sheetConfig.options"),
			noteChangesDetected: game.i18n.localize("PBTA.Settings.sheetConfig.noteChangesDetected"),
			noteConfirm: game.i18n.localize("PBTA.Settings.sheetConfig.noteConfirm"),
			noteConfirmUpdate: game.i18n.localize("PBTA.Settings.sheetConfig.noteConfirmUpdate"),
			noteConfirmUpdateBold: game.i18n.localize("PBTA.Settings.sheetConfig.noteConfirmUpdateBold"),
			noteCancel: game.i18n.localize("PBTA.Settings.sheetConfig.noteCancel"),
			values: game.i18n.localize("PBTA.Settings.sheetConfig.values")
		};

		// eslint-disable-next-line max-len
		if (hasAdditions || hasDeletions || hasMax || hasSoftType || hasHardType || hasSafe || hasOptions || hasDeletedValues) {
			let content = `<p>${t.noteChangesDetected}</p><ul><li>${t.noteConfirm}</li><li>${t.noteConfirmUpdate}<strong> (${t.noteConfirmUpdateBold})</strong></li><li>${t.noteCancel}</li></ul>`;

			if (hasAdditions) {
				content = `${content}<h2>${t.additions}</h2><ul class="pbta-changes"><li><strong> + </strong>${configDiff.add.join("</li><li><strong> + </strong>")}</li></ul>`;
			}

			if (hasDeletions) {
				content = `${content}<h2>${t.deletions}</h2><ul class="pbta-changes"><li><strong> - </strong>${configDiff.del.join("</li><li><strong> - </strong>")}</li></ul>`;
			}

			if (hasMax) {
				content = `${content}<h2>${t.maxValue}</h2><ul class="pbta-changes"><li><strong> * </strong>${configDiff.max.join("</li><li><strong> * </strong>")}</li></ul>`;
			}

			if (hasSoftType) {
				content = `${content}<h2>${t.type}</h2><ul class="pbta-changes"><li><strong> * </strong>${configDiff.softType.join("</li><li><strong> * </strong>")}</li></ul>`;
			}

			if (hasHardType) {
				content = `${content}<h2>${t.typeReset}</h2><ul class="pbta-changes"><li><strong> * </strong>${configDiff.hardType.join("</li><li><strong> * </strong>")}</li></ul>`;
			}

			if (hasSafe) {
				content = `${content}<h2>${t.cosmetic}</h2><ul class="pbta-changes"><li><strong> * </strong>${configDiff.safe.join("</li><li><strong> * </strong>")}</li></ul>`;
			}

			if (hasOptions) {
				content = `${content}<h2>${t.options}</h2><ul class="pbta-changes"><li><strong> * </strong>${configDiff.options.join("</li><li><strong> * </strong>")}</li></ul>`;
			}

			if (hasDeletedValues) {
				content = `${content}<h2>${t.values}</h2><ul class="pbta-changes"><li><strong> * </strong>${configDiff.values.join("</li><li><strong> * </strong>")}</li></ul>`;
			}

			return this._confirm({
				title: game.i18n.localize("PBTA.Settings.sheetConfig.confirmChanges"),
				content: content,
				options: { width: 500, classes: ["pbta", "pbta-sheet-confirm"] },
				buttons: {
					yes: {
						icon: '<i class="fas fa-check"></i>',
						label: game.i18n.localize("PBTA.Settings.sheetConfig.confirm"),
						callback: async () => {
							return true;
						}
					},
					update: {
						icon: '<i class="fas fa-user-check"></i>',
						label: game.i18n.localize("PBTA.Settings.sheetConfig.confirmUpdate"),
						callback: async () => {
							let result = await game.pbta.utils.updateActors(updatesDiff);
							return result;
						}
					},
					no: {
						icon: '<i class="fas fa-times"></i>',
						label: game.i18n.localize("Cancel"),
						callback: async () => {
							return false;
						}
					}
				},
				defaultButton: "no"
			});
		}
		return true;
	}

	async _confirm({ title, content, buttons, defaultButton, options = {}, rejectClose = false, render }={}) {
		return new Promise((resolve, reject) => {
			let resolveButtons = {};

			for (let [k, v] of Object.entries(buttons)) {
				resolveButtons[k] = {
					icon: v.icon ?? null,
					label: v.label ?? null,
					callback: (html) => {
						const result = v.callback ? v.callback(html) : true;
						resolve(result);
					}
				};
			}

			const dialog = new Dialog({
				title: title,
				content: content,
				buttons: resolveButtons,
				default: defaultButton ?? Object.keys(resolveButtons)[0],
				render: render,
				close: () => {
					if (rejectClose) {
						reject("The confirmation Dialog was closed without a choice being made");
					} else {
						resolve(null);
					}
				}
			}, options);
			dialog.render(true);
		});
	}

	optionsAreDifferent(options1, options2) {
		if (!options1 || !options2) {
			return true;
		}

		let arr1 = Object.values(options1).map((a) => a.label);
		let arr2 = Object.values(options2).map((a) => a.label);

		let options1String = arr1.sort().join("");
		let options2String = arr2.sort().join("");

		return options1String !== options2String;
	}
}
