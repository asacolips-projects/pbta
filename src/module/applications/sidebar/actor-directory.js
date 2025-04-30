export default class ActorDirectoryPbtA extends foundry.applications.sidebar.tabs.ActorDirectory {
	static _entryPartial = "systems/pbta/templates/sidebar/actor-document-partial.hbs";

	static DEFAULT_OPTIONS = {
		collection: "Actor",
		renderUpdateKeys: ["name", "img", "ownership", "sort", "folder", "system.advancements", "system.playbook.name"]
	};

	async _prepareContext(options) {
		const context = await super._prepareContext(options);
		Object.assign(context, {
			hideAdvancement: game.settings.get("pbta", "hideAdvancement") !== "none"
		});
		return context;
	}

	_getEntryContextOptions() {
		const options = super._getEntryContextOptions();
		return options.concat({
			name: "PBTA.ResetAdvancements",
			icon: '<i class="fas fa-undo"></i>',
			condition: (li) => {
				const document = this.collection.get(li.dataset.documentId);
				const advancements = foundry.utils.getProperty(document, "system.advancements") > 0;
				return advancements && game.user.isGM;
			},
			callback: (li) => {
				const document = this.collection.get(li.dataset.documentId);
				return document.update({ "system.advancements": 0 });
			}
		});
	}
}
