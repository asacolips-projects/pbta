export default class ActorDirectoryPbtA extends ActorDirectory {
	static entryPartial = "systems/pbta/templates/sidebar/actor-document-partial.hbs";

	static get defaultOptions() {
		const options = super.defaultOptions;
		options.renderUpdateKeys.push("system.advancements", "system.playbook.name");
		return options;
	}

	async getData(options) {
		const data = await super.getData(options);
		return foundry.utils.mergeObject(data, {
			hideAdvancement: game.settings.get("pbta", "hideAdvancement") !== "none"
		});
	}

	_getEntryContextOptions() {
		const options = super._getEntryContextOptions();
		return options.concat({
			name: "PBTA.ResetAdvancements",
			icon: '<i class="fas fa-undo"></i>',
			condition: (header) => {
				const li = header.closest(".directory-item");
				const document = this.collection.get(li.data("documentId"));
				const advancements = foundry.utils.getProperty(document, "system.advancements") > 0;
				return advancements && game.user.isGM;
			},
			callback: (header) => {
				const li = header.closest(".directory-item");
				const document = this.collection.get(li.data("documentId"));
				return document.update({ "system.advancements": 0 });
			}
		});
	}
}
