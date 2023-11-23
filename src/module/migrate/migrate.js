export class MigratePbta {

  static async runMigration() {
    // Retrieve the version.
    // const version = game.settings.get('pbta', 'systemMigrationVersion');

    // Update 1: Assign basic/special moves on actors.
    // if (version < 1) {
    //   this.updateSpecialMoves();
    //   version++;
    //   game.settings.set('pbta', 'systemMigrationVersion', version);
    // }

    const actors = game.actors.map(a => [a, true])
      .concat(Array.from(game.actors.invalidDocumentIds).map(id => [game.actors.getInvalid(id), false]));
    for ( const [actor, valid] of actors ) {
      try {
        const source = valid ? actor : game.data.actors.find(a => a._id === actor.id);
        let updateData = this.migrateActorData(source);
        if ( !foundry.utils.isEmpty(updateData) ) {
          console.log(`Migrating Actor document ${actor.name}`);
          await actor.update(updateData, {enforceTypes: false, diff: valid});
        }
      } catch(err) {
        err.message = `Failed system migration for Actor ${actor.name}: ${err.message}`;
        console.error(err);
      }
    }

    game.settings.set('pbta', 'systemMigrationVersion', game.system.version);
  }

  static migrateActorData(actor) {
    const updateData = {};
    for (let group of ['attrTop', 'attrLeft']) {
      const config = game.pbta.sheetConfig.actorTypes[actor.baseType]?.[group];
      const actorGroup = actor.system[group];

      if (config && actorGroup) {
        for (let [attrKey, attrValue] of Object.entries(config)) {
          const actorOptions = actorGroup[attrKey]?.options;
          if (
            ['ListOne', 'ListMany'].includes(attrValue.type) &&
            attrValue.options &&
            actorOptions &&
            Object.keys(attrValue.options).length !== Object.keys(actorOptions).length
          ) {
            const newOptions = {};
            for (let [optK, optV] of Object.entries(attrValue.options)) {
              const { label, tooltip, value, values } = optV;
              newOptions[optK] = {
                label,
                tooltip,
                value: actor.system[group][attrKey].options[optK].value ?? value
              }
              if (values) {
                newOptions[optK].values = actor.system[group][attrKey].options?.[optK]?.values ?? values;
              }
              delete actor.system[group][attrKey].options?.[optK];
            }
            for (let optK of Object.keys(actor.system[group][attrKey].options)) {
              newOptions[`-=${optK}`] = null;
            }
            updateData[`system.${group}.${attrKey}.options`] = newOptions;
          }
        }
      }
    }

    return updateData;
  };
}