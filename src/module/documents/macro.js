/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
export async function createPbtaMacro(data, slot) {
	const macroData = { type: "script", scope: "actor" };
	const itemData = await Item.implementation.fromDropData(data);
	if (!itemData) {
		ui.notifications.warn("You can only create macro buttons for owned Items");
		return null;
	}
	foundry.utils.mergeObject(macroData, {
		name: itemData.name,
		img: itemData.img,
		command: `pbta.documents.macro.rollItemMacro("${itemData.name}")`,
		flags: {
			"pbta.itemMacro": true,
			"pbta.itemUuid": data.uuid
		}
	});
	const macro = game.macros.find((m) => {
		return (m.name === macroData.name) && (m.command === macroData.command) && m.isAuthor;
	}) || await Macro.create(macroData);
	game.user.assignHotbarMacro(macro, slot);
}

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {string} name
 * @returns {Promise}
 */
export function rollItemMacro(name) {
	let actor;
	const speaker = ChatMessage.getSpeaker();
	if (speaker.token) actor = game.actors.tokens[speaker.token];
	actor ??= game.actors.get(speaker.actor);
	if (!actor) {
		ui.notifications.warn("PBTA.Warnings.Macro.NoActorSelected", { localize: true });
		return null;
	}

	const documents = actor.items.filter((i) => foundry.utils.getProperty(i, "name") === name);
	if (documents.length === 0) {
		ui.notifications.warn(game.i18n.format("PBTA.Warnings.Macro.MissingTargetWarn", { actor: actor.name, name }));
		return null;
	}
	if (documents.length > 1) {
		ui.notifications.warn(game.i18n.format("PBTA.Warnings.Macro.MultipleTargetsWarn", { actor: actor.name, name }));
	}
	return documents[0].roll();
}
