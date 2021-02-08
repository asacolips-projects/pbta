export class PbtaActorTemplates {
  static applyActorTemplate(actor, options, id) {
    let origData = actor?.data?.data ? duplicate(actor.data.data) : {};
    let data = duplicate(origData);

    let actorType = actor.type ?? 'character';

    data = mergeObject(origData, game.system.template.Actor[actorType]);
    delete data.templates;
    delete data._id;

    return data;

    // await actor.update({
    //   _id: actor.data._id,
    //   data: data
    // });
  }

  static async updateActors(newConfig, options={}) {
    console.log(newConfig);

    // Get all active actors.
    let entities = {
      'character': Object.keys(newConfig.character).length > 0 ? game.actors.filter(a => a.data.type == 'character') : [],
      'npc': Object.keys(newConfig.npc).length > 0 ? game.actors.filter(a => a.data.type == 'npc') : []
    };

    let updates = [];

    for (let [actorType, actors] of Object.entries(entities)) {
      for (let actor of actors) {
        let update = duplicate(newConfig[actorType]);
        update['_id'] = actor.id;
        updates.push(update);
      }
    }

    if (updates.length > 0) {
      try {
        await Actor.update(updates, options);
        return true;
      } catch (error) {
        console.log(error);
        return false;
      }
    }
    else {
      return true;
    }
  }

  static applyItemTemplate(actor, itemData, options, id) {
    let newItemData = duplicate(itemData);
    if (!newItemData.data) newItemData.data = {};

    let resultRanges = game.pbta.sheetConfig.rollResults;
    let data = newItemData.data;
    if (!data.moveResults) data.moveResults = {};

    for (let [key, value] of Object.entries(resultRanges)) {
      if (!data.moveResults[key]) {
        data.moveResults[key] = {
          key: `data.moveResults.${key}.value`,
          label: value.label,
          value: ''
        };
      }
    }

    return newItemData;
  }
}