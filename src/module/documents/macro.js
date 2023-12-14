/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
export async function createPbtaMacro(data, slot) {
	// First, determine if this is a valid owned item.
	if (data.type !== "Item") {
		return;
	}
	if (!data.uuid.includes("Actor.") && !data.uuid.includes("Token.")) {
		return ui.notifications.warn("You can only create macro buttons for owned Items");
	}
	// If it is, retrieve it based on the uuid.
	const item = await Item.fromDropData(data);

	// Create the macro command
	// @todo refactor this to use uuids and folders.
	const command = `game.pbta.rollItemMacro("${item.name}");`;
	let macro = game.macros.find((m) => (m.name === item.name) && (m.command === command));
	if (!macro) {
		macro = await Macro.create({
			name: item.name,
			type: "script",
			img: item.img,
			command: command,
			flags: {
				"pbta.itemMacro": true,
				"pbta.itemUuid": data.uuid
			}
		});
	}
	game.user.assignHotbarMacro(macro, slot);
	return false;
}

// eslint-disable-next-line jsdoc/require-returns-check
/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {string} itemData
 * @returns {Promise}
 */
export function rollItemMacro(itemData) {
	// Reconstruct the drop data so that we can load the item.
	// @todo this section isn't currently used, the name section below is used.
	if (itemData.includes("Actor.") || itemData.includes("Token.")) {
		const dropData = {
			type: "Item",
			uuid: itemData
		};
		Item.fromDropData(dropData).then((item) => {
			// Determine if the item loaded and if it's an owned item.
			if (!item || !item.parent) {
				const itemName = item?.name ?? itemData;
				return ui.notifications.warn(`Could not find item ${itemName}. You may need to delete and recreate this macro.`);
			}

			// Trigger the item roll
			item.roll();
		});
	} else {
		const speaker = ChatMessage.getSpeaker();
		let actor;
		if (speaker.token) {
			actor = game.actors.tokens[speaker.token];
		}
		if (!actor) {
			actor = game.actors.get(speaker.actor);
		}
		const item = actor ? actor.items.find((i) => i.name === itemData) : null;
		if (!item) {
			return ui.notifications.warn(`Your controlled Actor does not have an item named ${itemData}`);
		}

		// Trigger the item roll
		item.roll();
	}
}
