export default class PbtaTokenConfig extends foundry.applications.sheets.TokenConfig {
	async _prepareResourcesTab() {
		const resources = super._prepareResourcesTab();

		const usesTrackableAttributes = !foundry.utils.isEmpty(CONFIG.Actor.trackableAttributes);
		const attributeSource = this.actor?.system instanceof foundry.abstract.DataModel && usesTrackableAttributes
			? (this.actor?.type === "other" ? this.actor.sheetType : this.actor.type)
			: this.actor?.system;
		const TokenDocument = getDocumentClass("Token");
		const attributes = TokenDocument.getTrackedAttributes(attributeSource);
		resources.barAttributes = TokenDocument.getTrackedAttributeChoices(attributes);
		return resources;
	}
}
