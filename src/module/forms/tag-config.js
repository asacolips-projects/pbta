export class PbtaTagConfigDialog extends FormApplication {
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			title: game.i18n.localize("PBTA.Settings.tagConfig.label"),
			id: "pbta-tag-config",
			classes: ["pbta", "pbta-tag-config"],
			template: "systems/pbta/templates/dialog/tag-config.html",
			width: 720,
			height: "auto",
			resizable: true,
			closeOnSubmit: true
		});
	}

	async getData(options) {
		const { general = {}, actor = {}, item = {} } = game.settings.get("pbta", "tagConfig") ?? {};

		for (let key of Object.keys(actor)) {
			if (key === "all") {
				continue;
			}
			if (!(key in game.pbta.sheetConfig.actorTypes)) {
				delete actor[key];
			}
		}
		for (let key of Object.keys(game.pbta.sheetConfig.actorTypes)) {
			if (!(key in actor)) {
				actor[key] = "";
			}
		}

		const getLabels = (list, type) => {
			return Object.entries(list).reduce((obj, [k, v]) => {
				const pbtaLabel = game.pbta.sheetConfig.actorTypes[k]?.label;
				let label = CONFIG[type]?.typeLabels?.[k];
				if (k === "all") {
					label = game.i18n.format(`PBTA.Settings.tagConfig.Labels.${k}`, {
						documentType: game.i18n.localize(`DOCUMENT.${type}s`)
					});
				} else if (game.i18n.has(label)) {
					label = game.i18n.localize(label);
				}
				obj[k] = {
					label: pbtaLabel || label,
					value: v
				};
				return obj;
			}, {});
		};

		return {
			userTags: {
				general,
				actor: getLabels(actor, "Actor"),
				item: getLabels(item, "Item")
			},
			moduleTags: game.pbta.tagConfigOverride ?? {}
		};
	}

	async activateListeners(html) {
		super.activateListeners(html);
		await this._tagify(html);
		this.setPosition();
	}

	async _updateObject(event, formData) {
		const { userTags = {} } = foundry.utils.expandObject(formData);
		await game.settings.set("pbta", "tagConfig", userTags);
		game.pbta.tagList = null;
	}

	/**
	 * Add tagging widget.
	 * @param {HTMLElement} html
	 */
	async _tagify(html) {
		const data = foundry.utils.deepClone(await this.getData());
		const { userTags, moduleTags } = data;

		new Tagify(html.find('input[name="userTags.general"]')[0], {
			dropdown: {
				enabled: false
			}
		});
		if (html.find('input[name="moduleTags.general"]').length) {
			new Tagify(html.find('input[name="moduleTags.general"]')[0], {
				dropdown: {
					enabled: false
				}
			});
		}
		delete userTags.general;
		delete moduleTags.general;

		const initializeTagify = (tags, path) => {
			for (let tag in tags) {
				for (let t in tags[tag]) {
					new Tagify(html.find(`input[name="${path}.${tag}.${t}"]`)[0], {
						dropdown: {
							enabled: false
						}
					});
				}
			}
		};

		initializeTagify(userTags, "userTags");
		initializeTagify(moduleTags, "moduleTags");
	}
}
