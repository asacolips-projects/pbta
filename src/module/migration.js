/**
 * Perform a system migration for the entire World, applying migrations for Actors, Items, and Compendium packs
 */
export async function migrateWorld() {
	const version = game.system.version;
	ui.notifications.info(game.i18n.format("PBTA.Migration.Begin", {version}), {permanent: true});

	// Migrate World Actors
	const actors = game.actors.map((a) => [a, true])
		.concat(Array.from(game.actors.invalidDocumentIds).map((id) => [game.actors.getInvalid(id), false]));
	for (const [actor, valid] of actors) {
		try {
			const source = valid ? actor.toObject() : game.data.actors.find((a) => a._id === actor.id);
			let updateData = migrateActorData(source);
			if (!foundry.utils.isEmpty(updateData)) {
				console.log(`Migrating Actor document ${actor.name}`);
				await actor.update(updateData, {enforceTypes: false, diff: valid});
			}
		} catch(err) {
			err.message = `Failed pbta system migration for Actor ${actor.name}: ${err.message}`;
			console.error(err);
		}
	}

	// Migrate World Compendium Packs
	for (let p of game.packs) {
		if (p.metadata.packageType !== "world") continue;
		if (!["Actor"].includes(p.documentName)) continue;
		await migrateCompendium(p);
	}

	game.settings.set("pbta", "systemMigrationVersion", game.system.version);
	ui.notifications.info(game.i18n.format("PBTA.Migration.Complete", {version}), {permanent: true});
}

/**
 * Migrate a single Actor document to incorporate latest data model changes
 * Return an Object of updateData to be applied
 * @param {object} actor            The actor data object to update
 * @returns {object}                The updateData to apply
 */
export function migrateActorData(actor) {
	const updateData = {};
	// Migrate Owned Items
	if (!actor.items) return updateData;
	const items = actor.items.reduce((arr, i) => {
		// Migrate the Owned Item
		const itemData = i instanceof CONFIG.Item.documentClass ? i.toObject() : i;

		if ((itemData.system.actorType !== undefined) && (actor.system?.actorType !== actor.type)) {
			arr.push({ "system.actorType": actor.type, _id: itemData._id });
		}

		return arr;
	}, []);
	if (items.length > 0) updateData.items = items;

	return updateData;
}

/**
 * Apply migration rules to all Documents within a single Compendium pack
 * @param {CompendiumCollection} pack  Pack to be migrated.
 * @returns {Promise}
 */
export const migrateCompendium = async function (pack) {
	const documentName = pack.documentName;
	if (!["Actor"].includes(documentName)) return;

	// Unlock the pack for editing
	const wasLocked = pack.locked;
	await pack.configure({locked: false});

	// Begin by requesting server-side data model migration and get the migrated content
	await pack.migrate();
	const documents = await pack.getDocuments();

	// Iterate over compendium entries - applying fine-tuned migration functions
	for (let doc of documents) {
		let updateData = {};
		try {
			const source = doc.toObject();
			updateData = migrateActorData(source);

			// Save the entry, if data was changed
			if (foundry.utils.isEmpty(updateData)) continue;
			await doc.update(updateData);
			console.log(`Migrated ${documentName} document ${doc.name} in Compendium ${pack.collection}`);
		} catch(err) {
			err.message = `Failed pbta system migration for document ${doc.name} in pack ${pack.collection}: ${err.message}`;
			console.error(err);
		}
	}

	// Apply the original locked status for the pack
	await pack.configure({locked: wasLocked});
	console.log(`Migrated all ${documentName} documents from Compendium ${pack.collection}`);
};

/* -------------------------------------------- */
