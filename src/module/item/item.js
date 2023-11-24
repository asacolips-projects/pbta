import { PbtaActorTemplates } from '../pbta/pbta-actors.js';
import { PbtaRolls } from "../rolls.js";
import { PbtaUtility } from "../utility.js";

export class ItemPbta extends Item {
  static getDefaultArtwork(itemData) {
		if (itemData.type === "move" || itemData.type === "npcMove") {
			return { img: "icons/svg/upgrade.svg" };
		} else if (itemData.type === "playbook") {
			return { img: "icons/svg/book.svg" };
		} else if (itemData.type === "tag") {
			return { img: "systems/pbta/assets/icons/svg/tag.svg" };
		}
		return { img: this.DEFAULT_ICON };
	}

  /**
   * Augment the basic Item data model with additional dynamic data.
   */
  prepareData() {
    super.prepareData();
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
      const templateData = PbtaActorTemplates.applyItemTemplate(this, options, null);
      this.updateSource({
        system: mergeObject(templateData.system, this.toObject(false).system)
      });
    }
  }
}