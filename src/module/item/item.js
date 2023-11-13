import { PbtaActorTemplates } from '../pbta/pbta-actors.js';
import { PbtaUtility } from "../utility.js";
import { PbtaRolls } from "../rolls.js";

export class ItemPbta extends Item {
  /**
   * Augment the basic Item data model with additional dynamic data.
   */
  prepareData() {
    super.prepareData();

    // Get the Item's data
    const itemData = this;
    const actorData = this.actor ? this.actor : {};
    const data = itemData.system;

    // Clean up broken groups.
    if (itemData.type == 'class') {
      if (itemData.system.equipment) {
        for (let [group_key, group] of Object.entries(itemData.system.equipment)) {
          if (group) {
            if (PbtaUtility.isEmpty(group['items'])) {
              group['items'] = [];
              group['objects'] = [];
            }
          }
        }
      }
    }
  }

  async _getEquipmentObjects(force_reload = false) {
    let obj = null;
    let itemData = this;

    let items = await PbtaUtility.getEquipment(force_reload);
    let equipment = [];

    if (itemData.system.equipment) {
      for (let [group, group_items] of Object.entries(itemData.system.equipment)) {
        if (group_items) {
          equipment[group] = items.filter(i => group_items['items'].includes(i._id));
        }
      }
    }

    return equipment;
  }

  /**
   * Roll the item to Chat, creating a chat card which contains follow up attack or damage roll options
   * @return {Promise}
   */
  async roll({ configureDialog = true, descriptionOnly = false } = {}) {
    PbtaRolls.rollMove({actor: this.actor, data: this, parameters: { configureDialog, descriptionOnly }});
  }

  /** @inheritdoc */
  async _preCreate(data, options, userId) {
    await super._preCreate(data, options, userId);

    if (this.type == 'move' || this.type == 'npcMove') {
      // TODO: This needs to load the appropriate stats per class.
      let item = this;
      let templateData = PbtaActorTemplates.applyItemTemplate(item, options, null);
      this.updateSource({
        system: mergeObject(templateData.system, this.toObject(false).system)
      });
    }
  }
}