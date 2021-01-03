export class PbtaActorTemplates {
  static async applyActorTemplate(actor, options, id) {
    let origData = duplicate(actor.data.data);
    let data = duplicate(actor.data.data);
    data = mergeObject(origData, game.system.template.Actor['character']);
    delete data.templates;
    delete data._id;

    await actor.update({
      _id: actor.data._id,
      data: data
    });
  }

  static async migrateActorTemplate(actor, newData) {
    // TODO: Write a method to replace actor data with a new data structure.
  }
}