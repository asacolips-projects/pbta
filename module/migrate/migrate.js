export class MigratePbta {

  static runMigration() {
    // Retrieve the version.
    let version = game.settings.get('pbta', 'systemMigrationVersion');

    // Update 1: Assign basic/special moves on actors.
    if (version < 1) {
      this.updateSpecialMoves();
      version++;
      game.settings.set('pbta', 'systemMigrationVersion', version);
    }
  }

  static async updateSpecialMoves() {
    const basicMoves = [
      'Aid or Interfere',
      'Parley',
      'Defend',
      'Defy Danger',
      'Discern Realities',
      'Hack & Slash',
      'Spout Lore',
      'Volley'
    ];

    const specialMoves = [
      'Bolster',
      'Carouse',
      'Encumbrance',
      'End of Session',
      'Last Breath',
      'Level Up',
      'Make Camp',
      'Outstanding Warrants',
      'Recover',
      'Recruit',
      'Supply',
      'Take Watch',
      'Undertake A Perilous Journey'
    ];

    // Query actors.
    let actors = game.actors.filter(a => a.data.type == 'character');
    for (let actor of actors) {
      // Query moves on this actor.
      let items = actor.items.filter(i => i.data.type == 'move');
      // Iterate through each move and update them as needed.
      for (let item of items) {
        let moveType = null;

        // Basic moves.
        if (basicMoves.includes(item.data.name)) {
          moveType = 'basic';
        }
        // Special moves.
        else if (specialMoves.includes(item.data.name)) {
          moveType = 'special';
        }

        // If this is a valid move, update it.
        if (moveType) {
          await actor.updateEmbeddedEntity("OwnedItem", {
            _id: item._id,
            name: item.name,
            data: {
              moveType: moveType
            }
          });
        }
      }
    }

  }

  /*
   * Manual migration function.
   *
   * This function should not be part of an automatic migration. It is instead
   * a template that can be used if the IDs on class equipment groups get out
   * of sync, with the intent that an older version of the equipment compendiums
   * are pulled from a previous commit to use as a mapping.
   */
  static async updateClassCompendiums() {
    let classes = [];
    let itemsCurrent = [];
    let itemsOld = [];
    let itemMap = {};
    // Grab compendium data.
    for (let pack of game.packs) {
      if (pack.metadata.name.includes('equipment')) {
        if (pack.metadata.name.includes('old')) {
          itemsOld = itemsOld.concat(await pack.getContent());
        }
        else {
          itemsCurrent = itemsCurrent.concat(await pack.getContent());
        }
      }
      else if (pack.metadata.name.includes('classes')) {
        classes = await pack.getContent();
      }
    }
    // Build a mapping of old > new items.
    for (let oldItem of itemsOld) {
      let newItem = itemsCurrent.find(i => i.name == oldItem.name);
      if (newItem?._id) {
        itemMap[oldItem._id] = newItem._id;
      }
    }
    // Get the class compendium data.
    for (let charClass of classes) {
      let classItem = charClass.data;
      let hasUpdate = false;
      for (let [k,v] of Object.entries(classItem.data.equipment)) {
        v.items = v.items.map(i => {
          return itemMap[i];
        });
      }
      let updates = {
        _id: classItem._id,
        "data.equipment": classItem.data.equipment
      };
      await charClass.update(updates);
    }

    // Output debug.
    console.log({
      itemsCurrent: itemsCurrent,
      itemsOld: itemsOld,
      itemMap: itemMap
    });
  }

}
