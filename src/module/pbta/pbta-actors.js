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

  static async migrateActorTemplate(actor, newData) {
    // TODO: Write a method to replace actor data with a new data structure.
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