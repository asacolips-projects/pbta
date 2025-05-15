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
		const tags = await this.createTagify(html);
		for (const t of tags) {
			t.on("edit:start", ({ detail: { tag, data } }) => CONFIG.TagHandler.onEdit(t, { tag, data }));
		}
		this.setPosition();
	}

	async _updateObject(event, formData) {
		const { userTags = {} } = foundry.utils.expandObject(formData);
		await game.settings.set("pbta", "tagConfig", userTags);
		game.pbta.tagList = null;
	}

	/**
	 * Adding a tag template that puts the description in the tooltip.
	 * If the description doesn't exist, there is not tool-tip
	 * @param {any} tagData
	 * @returns {string} an HTML template for the tag
	 */
	_tagTemplate(tagData) {
		return `
			<tag data-tooltip="${tagData.description || ""}"
					class="tagify__tag ${tagData.class ? tagData.class : ""}" ${this.getAttributes(tagData)}>
				<x title='' class='tagify__tag__removeBtn' role='button' aria-label='remove tag'></x>
				<div>
					<span class='tagify__tag-text'>${tagData.value}</span>
				</div>
			</tag>
		`;
	}

	/**
	 * Allows User input of tags with descriptions in
	 * the form of "tag name"|"tag description"
	 * @param {any} tagData
	 */
	_transformTag(tagData) {
		let parts = tagData.value.split(/\|/);
		let value = parts[0].trim();
		let description = parts[1]?.replace(/\|/, "").trim();

		tagData.value = value;
		tagData.description = description || tagData.description;
	}

	/**
	 * Add tagging widget.
	 * @param {HTMLElement} html
	 * @returns {Promise<Tagify[]>}
	 */
	async createTagify(html) {
		const data = foundry.utils.deepClone(await this.getData());
		const { userTags, moduleTags } = data;

		const TAGS = [];

		TAGS.push(new Tagify(html.find('input[name="userTags.general"]')[0], CONFIG.TagHandler.config));
		if (html.find('input[name="moduleTags.general"]').length) {
			TAGS.push(new Tagify(html.find('input[name="moduleTags.general"]')[0], CONFIG.TagHandler.config));
		}
		delete userTags.general;
		delete moduleTags.general;

		const initializeTagify = (tags, path) => {
			for (let tag in tags) {
				for (let t in tags[tag]) {
					TAGS.push(new Tagify(html.find(`input[name="${path}.${tag}.${t}"]`)[0], CONFIG.TagHandler.config));
				}
			}
		};

		initializeTagify(userTags, "userTags");
		initializeTagify(moduleTags, "moduleTags");
		return TAGS;
	}
}
