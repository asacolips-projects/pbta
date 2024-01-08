/**
 * Perform a system migration for the entire World, applying migrations for Actors, Items, and Compendium packs
 */
export async function migrateWorld() {
	const version = game.system.version;
	ui.notifications.info(game.i18n.format("PBTA.Migration.Begin", { version }), { permanent: true });

	const migrationData = await getMigrationData();

	// Migrate World Actors
	const actors = game.actors.map((a) => [a, true])
		.concat(Array.from(game.actors.invalidDocumentIds).map((id) => [game.actors.getInvalid(id), false]));
	for (const [actor, valid] of actors) {
		try {
			const flags = { persistSourceMigration: false };
			const source = valid ? actor.toObject() : game.data.actors.find((a) => a._id === actor.id);
			let updateData = migrateActorData(source, migrationData, flags);
			if (!foundry.utils.isEmpty(updateData)) {
				console.log(`Migrating Actor document ${actor.name}`);
				if (flags.persistSourceMigration) {
					updateData = foundry.utils.mergeObject(source, updateData, { inplace: false });
				}
				await actor.update(updateData, { enforceTypes: false, diff: valid && !flags.persistSourceMigration });
			}
		} catch(err) {
			err.message = `Failed pbta system migration for Actor ${actor.name}: ${err.message}`;
			console.error(err);
		}
	}

	const items = game.items.map((i) => [i, true])
		.concat(Array.from(game.items.invalidDocumentIds).map((id) => [game.items.getInvalid(id), false]));
	for (const [item, valid] of items) {
		try {
			const flags = { persistSourceMigration: false };
			const source = valid ? item.toObject() : game.data.items.find((i) => i._id === item.id);
			let updateData = migrateItemData(source, migrationData, flags);
			if (!foundry.utils.isEmpty(updateData)) {
				console.log(`Migrating Item document ${item.name}`);
				if (flags.persistSourceMigration) {
					updateData = foundry.utils.mergeObject(source, updateData, { inplace: false });
				}
				await item.update(updateData, { enforceTypes: false, diff: valid && !flags.persistSourceMigration });
			}
		} catch(err) {
			err.message = `Failed pbta system migration for Item ${item.name}: ${err.message}`;
			console.error(err);
		}
	}

	// Migrate World Macros
	for (const m of game.macros) {
		try {
			const updateData = migrateMacroData(m.toObject(), migrationData);
			if (!foundry.utils.isEmpty(updateData)) {
				console.log(`Migrating Macro document ${m.name}`);
				await m.update(updateData, { enforceTypes: false });
			}
		} catch(err) {
			err.message = `Failed pbta system migration for Macro ${m.name}: ${err.message}`;
			console.error(err);
		}
	}

	// Migrate World Roll Tables
	for (const table of game.tables) {
		try {
			const updateData = migrateRollTableData(table.toObject(), migrationData);
			if (!foundry.utils.isEmpty(updateData)) {
				console.log(`Migrating RollTable document ${table.name}`);
				await table.update(updateData, { enforceTypes: false });
			}
		} catch(err) {
			err.message = `Failed pbta system migration for RollTable ${table.name}: ${err.message}`;
			console.error(err);
		}
	}

	// Migrate Actor Override Tokens
	for (let s of game.scenes) {
		try {
			const updateData = migrateSceneData(s, migrationData);
			if (!foundry.utils.isEmpty(updateData)) {
				console.log(`Migrating Scene document ${s.name}`);
				await s.update(updateData, { enforceTypes: false });
				// If we do not do this, then synthetic token actors remain in cache
				// with the un-updated actorData.
				s.tokens.forEach((t) => t._actor = null);
			}
		} catch(err) {
			err.message = `Failed pbta system migration for Scene ${s.name}: ${err.message}`;
			console.error(err);
		}
	}

	// Migrate World Compendium Packs
	for (let p of game.packs) {
		if (p.metadata.packageType !== "world") continue;
		if (!["Actor", "Item", "Scene"].includes(p.documentName)) continue;
		await migrateCompendium(p);
	}

	game.settings.set("pbta", "systemMigrationVersion", game.system.version);
	ui.notifications.info(game.i18n.format("PBTA.Migration.Complete", { version }), { permanent: true });
}

/**
 * Migrate a single Actor document to incorporate latest data model changes
 * Return an Object of updateData to be applied
 * @param {object} actor            The actor data object to update
 * @param {object} [migrationData]  Additional data to perform the migration
 * @param {object} [flags={}]       Track the needs migration flag.
 * @returns {object}                The updateData to apply
 */
export function migrateActorData(actor, migrationData, flags={}) {
	const updateData = {};

	// Migrate Owned Items
	if (!actor.items) return updateData;
	const items = actor.items.reduce((arr, i) => {
		// Migrate the Owned Item
		const itemData = i instanceof CONFIG.Item.documentClass ? i.toObject() : i;
		const itemFlags = { persistSourceMigration: false };

		let itemUpdate = migrateItemData(itemData, migrationData, itemFlags);

		if ((itemData.system.actorType !== undefined) && (actor.system?.actorType !== actor.type)) {
			arr.push({ "system.actorType": actor.type, _id: itemData._id });
		}

		// Update the Owned Item
		if (!foundry.utils.isEmpty(itemUpdate)) {
			if (itemFlags.persistSourceMigration) {
				itemUpdate = foundry.utils.mergeObject(itemData, itemUpdate, { inplace: false });
				flags.persistSourceMigration = true;
			}
			arr.push({ ...itemUpdate, _id: itemData._id });
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
	if (!["Actor", "Item", "Scene"].includes(documentName)) return;

	const migrationData = await getMigrationData();

	// Unlock the pack for editing
	const wasLocked = pack.locked;
	await pack.configure({ locked: false });

	// Begin by requesting server-side data model migration and get the migrated content
	await pack.migrate();
	const documents = await pack.getDocuments();

	// Iterate over compendium entries - applying fine-tuned migration functions
	for (let doc of documents) {
		let updateData = {};
		try {
			const flags = { persistSourceMigration: false };
			const source = doc.toObject();
			switch (documentName) {
				case "Actor":
					updateData = migrateActorData(source, migrationData, flags);
					break;
				case "Item":
					updateData = migrateItemData(source, migrationData, flags);
					break;
				case "Scene":
					updateData = migrateSceneData(source, migrationData, flags);
					break;
			}

			// Save the entry, if data was changed
			if (foundry.utils.isEmpty(updateData)) continue;
			if (flags.persistSourceMigration) updateData = foundry.utils.mergeObject(source, updateData);
			await doc.update(updateData);
			console.log(`Migrated ${documentName} document ${doc.name} in Compendium ${pack.collection}`);
		} catch(err) {
			err.message = `Failed pbta system migration for document ${doc.name} in pack ${pack.collection}: ${err.message}`;
			console.error(err);
		}
	}

	// Apply the original locked status for the pack
	await pack.configure({ locked: wasLocked });
	console.log(`Migrated all ${documentName} documents from Compendium ${pack.collection}`);
};

/* -------------------------------------------- */

/**
 * Migrate a single Item document to incorporate latest data model changes
 *
 * @param {object} item             Item data to migrate
 * @param {object} [migrationData]  Additional data to perform the migration
 * @param {object} [flags={}]       Track the needs migration flag.
 * @returns {object}                The updateData to apply
 */
export function migrateItemData(item, migrationData, flags={}) {
	const updateData = {};
	_migrateDocumentIcon(item, updateData, migrationData);

	if (foundry.utils.getProperty(item, "flags.pbta.persistSourceMigration")) {
		flags.persistSourceMigration = true;
		updateData["flags.pbta.-=persistSourceMigration"] = null;
	}

	return updateData;
}

/* -------------------------------------------- */

/**
 * Migrate the provided active effect data.
 * @param {object} effect           Effect data to migrate.
 * @param {object} [migrationData]  Additional data to perform the migration.
 * @returns {object}                The updateData to apply.
 */
export const migrateEffectData = function (effect, migrationData) {
	const updateData = {};
	_migrateDocumentIcon(effect, updateData, { ...migrationData, field: "icon" });
	return updateData;
};

/**
 * Migrate a single Macro document to incorporate latest data model changes.
 * @param {object} macro            Macro data to migrate
 * @param {object} [migrationData]  Additional data to perform the migration
 * @returns {object}                The updateData to apply
 */
export const migrateMacroData = function (macro, migrationData) {
	const updateData = {};
	_migrateDocumentIcon(macro, updateData, migrationData);
	_migrateMacroCommands(macro, updateData);
	return updateData;
};

/* -------------------------------------------- */

/**
 * Migrate a single RollTable document to incorporate the latest data model changes.
 * @param {object} table            Roll table data to migrate.
 * @param {object} [migrationData]  Additional data to perform the migration.
 * @returns {object}                The update delta to apply.
 */
export function migrateRollTableData(table, migrationData) {
	const updateData = {};
	_migrateDocumentIcon(table, updateData, migrationData);
	if (!table.results?.length) return updateData;
	const results = table.results.reduce((arr, result) => {
		const resultUpdate = {};
		_migrateDocumentIcon(result, resultUpdate, migrationData);
		if (!foundry.utils.isEmpty(resultUpdate)) {
			resultUpdate._id = result._id;
			arr.push(foundry.utils.expandObject(resultUpdate));
		}
		return arr;
	}, []);
	if (results.length) updateData.results = results;
	return updateData;
}

/* -------------------------------------------- */

/**
 * Migrate a single Scene document to incorporate changes to the data model of it's actor data overrides
 * Return an Object of updateData to be applied
 * @param {object} scene            The Scene data to Update
 * @param {object} [migrationData]  Additional data to perform the migration
 * @returns {object}                The updateData to apply
 */
export const migrateSceneData = function (scene, migrationData) {
	const tokens = scene.tokens.map((token) => {
		const t = token instanceof foundry.abstract.DataModel ? token.toObject() : token;
		const update = {};
		if (Object.keys(update).length) foundry.utils.mergeObject(t, update);
		if (!game.actors.has(t.actorId)) t.actorId = null;
		if (!t.actorId || t.actorLink) t.actorData = {};
		else if (!t.actorLink) {
			const actorData = token.delta?.toObject() ?? foundry.utils.deepClone(t.actorData);
			actorData.type = token.actor?.type;
			const update = migrateActorData(actorData, migrationData);
			t.delta = update;
		}
		return t;
	});
	return { tokens };
};

/* -------------------------------------------- */

/**
 * Fetch bundled data for large-scale migrations.
 * @returns {Promise<object>}  Object mapping original system icons to their core replacements.
 */
export const getMigrationData = async function () {
	const data = {};
	try {
		const icons = await fetch("systems/pbta/json/icon-migration.json");
		const spellIcons = await fetch("systems/pbta/json/spell-icon-migration.json");
		data.iconMap = { ...await icons.json(), ...await spellIcons.json() };
	} catch(err) {
		console.warn(`Failed to retrieve icon migration data: ${err.message}`);
	}
	return data;
};

/* -------------------------------------------- */

/**
 * Convert system icons to use bundled core webp icons.
 * @param {object} document                                 Document data to migrate
 * @param {object} updateData                               Existing update to expand upon
 * @param {object} [migrationData={}]                       Additional data to perform the migration
 * @param {Object<string, string>} [migrationData.iconMap]  A mapping of system icons to core foundry icons
 * @param {string} [migrationData.field]                    The document field to migrate
 * @returns {object}                                        The updateData to apply
 * @private
 */
function _migrateDocumentIcon(document, updateData, { iconMap, field="img" }={}) {
	let path = document?.[field];
	if (path && iconMap) {
		if (path.startsWith("/") || path.startsWith("\\")) path = path.substring(1);
		const rename = iconMap[path];
		if (rename) updateData[field] = rename;
	}
	return updateData;
}

/**
 * Migrate macros from the old 'pbta.rollItemMacro' and 'pbta.macros' commands to the new location.
 * @param {object} macro       Macro data to migrate.
 * @param {object} updateData  Existing update to expand upon.
 * @returns {object}           The updateData to apply.
 */
function _migrateMacroCommands(macro, updateData) {
	if (macro.command.includes("game.pbta.rollItemMacro")) {
		updateData.command = macro.command.replaceAll("game.pbta.rollItemMacro", "pbta.documents.macro.rollItem");
	}
	return updateData;
}

/**
 * A general tool to purge flags from all documents in a Compendium pack.
 * @param {CompendiumCollection} pack   The compendium pack to clean.
 * @private
 */
export async function purgeFlags(pack) {
	const cleanFlags = (flags) => {
		const flagsPbta = flags.pbta || null;
		return flagsPbta ? { pbta: flagsPbta } : {};
	};
	await pack.configure({ locked: false });
	const content = await pack.getDocuments();
	for (let doc of content) {
		const update = { flags: cleanFlags(doc.flags) };
		if (pack.documentName === "Actor") {
			update.items = doc.items.map((i) => {
				i.flags = cleanFlags(i.flags);
				return i;
			});
		}
		await doc.update(update, { recursive: false });
		console.log(`Purged flags from ${doc.name}`);
	}
	await pack.configure({ locked: true });
}
