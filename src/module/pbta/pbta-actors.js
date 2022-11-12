export class PbtaActorTemplates {
  static applyActorTemplate(actor, options, id) {
    let origSystemData = {};
    let systemData = {};

    // Copy the base actor data.
    origSystemData = actor.toObject(false).system;
    systemData = foundry.utils.deepClone(origSystemData);

    // Determine the actor type.
    let actorType = actor.type ?? 'character';
    let sheetType = actorType;
    if (sheetType == 'other') {
      sheetType = systemData?.customType ?? 'character';
    }

    // Merge it with the model for that for that actor type to include missing attributes.
    let origModel = game.system.model.Actor[sheetType] ?? game.pbta.sheetConfig.actorTypes[sheetType];
    let model = foundry.utils.deepClone(origModel);

    // Prepare and return the systemData.
    systemData = foundry.utils.mergeObject(model, systemData);
    delete systemData.templates;
    delete systemData._id;

    return systemData;
  }

  static async updateActors(newConfig, options={}) {
    let success = true;
    let newTokenConfig = {
      'character': {},
      'npc': {},
    };

    // Get all active actors.
    let documents = {
      'character': Object.keys(newConfig.character).length > 0 ? game.actors.filter(a => a.type == 'character') : [],
      'npc': Object.keys(newConfig.npc).length > 0 ? game.actors.filter(a => a.type == 'npc') : [],
    };

    // Determine if we need to query other actors.
    for (let actorType of Object.keys(newConfig)) {
      if (actorType == 'character' || actorType == 'npc') continue;
      if (!newTokenConfig[actorType]) newTokenConfig[actorType] = {};
      if (!documents[actorType]) {
        let actors = Object.keys(newConfig[actorType]).length > 0 ? game.actors.filter(a => a.type == 'other' && a.system?.customType == actorType) : [];
        documents[actorType] = actors;
      }
    }

    let updates = [];

    for (let [actorType, actors] of Object.entries(documents)) {
      // Tokens won't need the full update, we only need to do updates for
      // deleted keys. All other updates can be inferred from the base actor.
      for (let [cfgK, cfgV] of Object.entries(newConfig[actorType])) {
        if (cfgK.includes('-=')) {
          newTokenConfig[actorType][`actorData.${cfgK}`] = cfgV;
        }
      }

      // Build the updates array for actors.
      for (let actor of actors) {
        let update = duplicate(newConfig[actorType]);
        update['_id'] = actor.id;
        updates.push(update);
      }
    }

    // Apply updates to actors.
    if (updates.length > 0) {
      try {
        await Actor.updateDocuments(updates, options);
        success = true;
      } catch (error) {
        console.log(error);
        success = false
      }
    }

    // We also need to handle any attributes that were removed on tokens.
    // Otherwise, we could have removed attributes orphaned on synthetic actors.

    // Begin by iterating through all scenes.
    game.scenes.forEach(async (s) => {
      // Build the token updates array for this scene and load its tokens.
      let tokenUpdates = [];
      let tokens = s.getEmbeddedCollection('Token');
      // If there are tokens, we need to build updates.
      if (tokens.length > 0) {
        // Iterate through all of the tokens.
        tokens.forEach(t => {
          // We only need to handle updates if this is an unlinked token. If the
          // token is linked, it will have been handled automatically by the
          // actor updates in the previous step.
          if (!t.actorLink) {
            // We need to load the actor to get the actor type.
            let prototypeActor = game.actors.get(t.actorId);
            if (prototypeActor) {
              let actorType = prototypeActor.type;
              let sheetType = actorType != 'other' ? actorType : prototypeActor?.system?.customType;
              if (!sheetType) sheetType = 'character';
              // Build the update and append to the scene's update array.
              let tokenUpdate = duplicate(newTokenConfig[sheetType]);
              tokenUpdate['_id'] = t.id;
              tokenUpdates.push(tokenUpdate);
            }
          }
        });
      }
      // If this scene has token updates, we need to apply them to the
      // embedded token documents.
      if (tokenUpdates.length > 0) {
        try {
          await s.updateEmbeddedDocuments('Token', tokenUpdates);
        } catch (error) {
          console.log(error);
        }
      }
    });

    // Return whether or not the function was successful (which will allow
    // the dialog to proceed or fail).
    return success;
  }

  static applyItemTemplate(actor, itemData, options, id) {
    let newItemData = duplicate(itemData);
    if (!newItemData.system) newItemData.system = {};

    let resultRanges = game.pbta.sheetConfig.rollResults;
    if (!newItemData.system.moveResults) newItemData.system.moveResults = {};

    for (let [key, value] of Object.entries(resultRanges)) {
      if (!newItemData.system.moveResults[key]) {
        newItemData.system.moveResults[key] = {
          key: `system.moveResults.${key}.value`,
          label: value.label,
          value: ''
        };
      }
    }

    return newItemData;
  }
}