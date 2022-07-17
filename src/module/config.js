export const PBTA = {};

PBTA.abilities = {
  "str": "PBTA.AbilityStr",
  "dex": "PBTA.AbilityDex",
  "con": "PBTA.AbilityCon",
  "int": "PBTA.AbilityInt",
  "wis": "PBTA.AbilityWis",
  "cha": "PBTA.AbilityCha"
};

PBTA.debilities = {
  "str": "PBTA.DebilityStr",
  "dex": "PBTA.DebilityDex",
  "con": "PBTA.DebilityCon",
  "int": "PBTA.DebilityInt",
  "wis": "PBTA.DebilityWis",
  "cha": "PBTA.DebilityCha"
};

PBTA.attrTypes = [
  "Number",
  "Clock",
  "Xp",
  "Resource",
  "Text",
  "LongText",
  "Checkbox",
  "ListMany",
  // TODO: Add ListOne type.
  // "ListOne",
  "Roll"
];

export class PbtaPlaybooks {
  static async getPlaybooks(labels_only = true) {
    // First, retrieve any custom or overridden playbooks so that we can
    // prioritize those.
    let playbooks = game.items.filter(item => item.type == 'playbook');
    // Next, retrieve compendium playbooks and merge them in.
    for (let c of game.packs) {
      if (c.metadata.type && c.metadata.type == 'Item' && c.metadata.name.includes('playbooks')) {
        // Load the compendium and then merge it with the existing items. Filter
        // it to include only playbook items.
        let items = c ? await c.getDocuments() : [];
        playbooks = playbooks.concat(items.filter(i => i.type == 'playbook'));
      }
    }
    // Reduce duplicates. Because item playbooks happen first, this will prevent
    // duplicate compendium entries from overriding the items.
    let charPlaybookNames = [];
    for (let charPlaybook of playbooks) {
      let charPlaybookName = charPlaybook.name;
      if (charPlaybookNames.includes(charPlaybookName) !== false) {
        playbooks = playbooks.filter(item => item.id != charPlaybook.id);
      }
      else {
        charPlaybookNames.push(charPlaybookName);
      }
    }

    // Sort the charPlaybookNames list.
    if (labels_only) {
      charPlaybookNames.sort((a, b) => {
        const aSort = a.toLowerCase();
        const bSort = b.toLowerCase();
        if (aSort < bSort) {
          return -1;
        }
        if (aSort > bSort) {
          return 1;
        }
        return 0;
      });

      return charPlaybookNames;
    }
    // Sort the playbook objects list.
    else {
      playbooks.sort((a, b) => {
        const aSort = a.name.toLowerCase();
        const bSort = b.name.toLowerCase();
        if (aSort < bSort) {
          return -1;
        }
        if (aSort > bSort) {
          return 1;
        }
        return 0;
      });

      return playbooks;
    }
  }
}