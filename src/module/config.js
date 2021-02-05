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
  "ListOne",
  "Roll"
];

export class PbtaPlaybooks {
  static async getPlaybooks(labels_only = true) {
    // First, retrieve any custom or overridden playbooks so that we can
    // prioritize those.
    let playbooks = game.items.entities.filter(item => item.type == 'playbook');
    // Next, retrieve compendium playbooks and merge them in.
    for (let c of game.packs) {
      if (c.metadata.entity && c.metadata.entity == 'Item' && c.metadata.name == 'playbooks') {
        let items = c ? await c.getContent() : [];
        playbooks = playbooks.concat(items);
      }
    }
    // Reduce duplicates. Because item playbooks happen first, this will prevent
    // duplicate compendium entries from overriding the items.
    let charPlaybookNames = [];
    for (let charPlaybook of playbooks) {
      let charPlaybookName = charPlaybook.data.name;
      if (charPlaybookNames.includes(charPlaybookName) !== false) {
        playbooks = playbooks.filter(item => item._id != charPlaybook._id);
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
        const aSort = a.data.name.toLowerCase();
        const bSort = b.data.name.toLowerCase();
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