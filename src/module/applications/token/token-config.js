/* eslint-disable no-undef */
export default class PbtaTokenConfig extends TokenConfig {
	async getData(options={}) {
		const alternateImages = await this._getAlternateTokenImages();
		const attributeSource = this.actor?.system instanceof foundry.abstract.DataModel
			? (this.actor?.type === "other" ? this.actor.sheetType : this.actor.type)
			: this.actor?.system;
		const attributes = TokenDocument.implementation.getTrackedAttributes(attributeSource);
		const canBrowseFiles = game.user.hasPermission("FILES_BROWSE");
		const gridUnits = (this.isPrototype || !canvas.ready) ? game.system.gridUnits : canvas.scene.grid.units;

		// Prepare Token data
		const doc = this.preview ?? this.document;
		const token = doc.toObject();
		const basicDetection = token.detectionModes.find((m) => m.id === DetectionMode.BASIC_MODE_ID) ? null
			: doc.detectionModes.find((m) => m.id === DetectionMode.BASIC_MODE_ID);

		// Return rendering context
		return {
			cssClasses: [this.isPrototype ? "prototype" : null].filter((c) => !!c).join(" "),
			isPrototype: this.isPrototype,
			hasAlternates: !foundry.utils.isEmpty(alternateImages),
			alternateImages: alternateImages,
			object: token,
			options: this.options,
			gridUnits: gridUnits || game.i18n.localize("GridUnits"),
			barAttributes: TokenDocument.implementation.getTrackedAttributeChoices(attributes),
			bar1: doc.getBarAttribute?.("bar1"),
			bar2: doc.getBarAttribute?.("bar2"),
			colorationTechniques: AdaptiveLightingShader.SHADER_TECHNIQUES,
			visionModes: Object.values(CONFIG.Canvas.visionModes).filter((f) => f.tokenConfig),
			detectionModes: Object.values(CONFIG.Canvas.detectionModes).filter((f) => f.tokenConfig),
			basicDetection,
			displayModes: Object.entries(CONST.TOKEN_DISPLAY_MODES).reduce((obj, e) => {
				obj[e[1]] = game.i18n.localize(`TOKEN.DISPLAY_${e[0]}`);
				return obj;
			}, {}),
			actors: game.actors.reduce((actors, a) => {
				if (!a.isOwner) return actors;
				actors.push({ _id: a.id, name: a.name });
				return actors;
			}, []).sort((a, b) => a.name.localeCompare(b.name)),
			dispositions: Object.entries(CONST.TOKEN_DISPOSITIONS).reduce((obj, e) => {
				obj[e[1]] = game.i18n.localize(`TOKEN.DISPOSITION.${e[0]}`);
				return obj;
			}, {}),
			lightAnimations: Object.entries(CONFIG.Canvas.lightAnimations).reduce((obj, e) => {
				obj[e[0]] = game.i18n.localize(e[1].label);
				return obj;
			}, { "": game.i18n.localize("None") }),
			isGM: game.user.isGM,
			randomImgEnabled: this.isPrototype && (canBrowseFiles || doc.randomImg),
			scale: Math.abs(doc.texture.scaleX),
			mirrorX: doc.texture.scaleX < 0,
			mirrorY: doc.texture.scaleY < 0
		};
	}
}
