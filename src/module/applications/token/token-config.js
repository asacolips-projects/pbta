export default class PbtaTokenConfig extends TokenConfig {
	async getData(options={}) {
		const alternateImages = await this._getAlternateTokenImages();
		const attributeSource = this.actor?.system instanceof foundry.abstract.DataModel
			? (this.actor?.type === "other" ? this.actor.sheetType : this.actor.type)
			: this.actor?.system;
		const attributes = TokenDocument.implementation.getTrackedAttributes(attributeSource);
		const canBrowseFiles = game.user.hasPermission("FILES_BROWSE");

		// Prepare Token data
		const doc = this.preview ?? this.document;
		const source = doc.toObject();
		const sourceDetectionModes = new Set(source.detectionModes.map((m) => m.id));
		const preparedDetectionModes = doc.detectionModes.filter((m) => !sourceDetectionModes.has(m.id));

		// Return rendering context
		return {
			fields: doc.schema.fields,
			cssClasses: [this.isPrototype ? "prototype" : null].filter((c) => !!c).join(" "),
			isPrototype: this.isPrototype,
			hasAlternates: !foundry.utils.isEmpty(alternateImages),
			alternateImages: alternateImages,
			object: source,
			options: this.options,
			gridUnits: (this.isPrototype ? "" : this.document.parent?.grid.units) || game.i18n.localize("GridUnits"),
			barAttributes: TokenDocument.implementation.getTrackedAttributeChoices(attributes),
			bar1: doc.getBarAttribute?.("bar1"),
			bar2: doc.getBarAttribute?.("bar2"),
			colorationTechniques: AdaptiveLightingShader.SHADER_TECHNIQUES,
			visionModes: Object.values(CONFIG.Canvas.visionModes).filter((f) => f.tokenConfig),
			detectionModes: Object.values(CONFIG.Canvas.detectionModes).filter((f) => f.tokenConfig),
			preparedDetectionModes,
			displayModes: Object.entries(CONST.TOKEN_DISPLAY_MODES).reduce((obj, e) => {
				obj[e[1]] = game.i18n.localize(`TOKEN.DISPLAY_${e[0]}`);
				return obj;
			}, {}),
			hexagonalShapes: Object.entries(CONST.TOKEN_HEXAGONAL_SHAPES).reduce((obj, [k, v]) => {
				obj[v] = game.i18n.localize(`TOKEN.HEXAGONAL_SHAPE_${k}`);
				return obj;
			}, {}),
			showHexagonalShapes: this.isPrototype || !doc.parent || doc.parent.grid.isHexagonal,
			actors: game.actors.reduce((actors, a) => {
				if (!a.isOwner) return actors;
				actors.push({ _id: a.id, name: a.name });
				return actors;
			}, []).sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang)),
			dispositions: Object.entries(CONST.TOKEN_DISPOSITIONS).reduce((obj, e) => {
				obj[e[1]] = game.i18n.localize(`TOKEN.DISPOSITION.${e[0]}`);
				return obj;
			}, {}),
			lightAnimations: CONFIG.Canvas.lightAnimations,
			isGM: game.user.isGM,
			randomImgEnabled: this.isPrototype && (canBrowseFiles || doc.randomImg),
			scale: Math.abs(doc.texture.scaleX),
			mirrorX: doc.texture.scaleX < 0,
			mirrorY: doc.texture.scaleY < 0,
			textureFitModes: CONST.TEXTURE_DATA_FIT_MODES.reduce((obj, fit) => {
				obj[fit] = game.i18n.localize(`TEXTURE_DATA.FIT.${fit}`);
				return obj;
			}, {}),
			lightFields: doc.schema.fields.light.fields
		};
	}
}
