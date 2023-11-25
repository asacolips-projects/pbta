import { RollPbtA } from "../rolls.js";

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

  /**
   * Override getRollData() that's supplied to rolls.
   */
  getRollData() {
    let data = super.getRollData();
    data.type = this.type;
    if (this.actor && this.actor.system?.stats) {
      data = foundry.utils.mergeObject(data, this.actor.getRollData());
    }
    data.formula = this.getRollFormula();
    return data;
  }

  getRollFormula(defaultFormula = '2d6') {
    const rollFormula = this.system.rollFormula;
    if (rollFormula && Roll.validate(rollFormula)) {
      return rollFormula.trim()
    }
    return this.actor?.getRollFormula(defaultFormula) ?? game.pbta.sheetConfig.rollFormula ?? defaultFormula;
  }

  /**
   * Roll the item to Chat, creating a chat card which contains follow up attack or damage roll options
   * @return {Promise}
   */
  async roll({ configureDialog = true, descriptionOnly = false } = {}, options = {}) {
    if (!descriptionOnly && (this.type === 'equipment' || !this.system.rollType)) {
      descriptionOnly = true;
    }
    if (descriptionOnly) {
      const content = await renderTemplate('systems/pbta/templates/chat/chat-move.html', {
        image: this.img,
        title: this.name,
        details: this.system.description,
        tags: this.system.tags
      })
      ChatMessage.create({
        user: game.user.id,
        content: content,
        speaker: ChatMessage.getSpeaker({ actor: this.actor })
      });
    } else {
      let formula = "@formula";
      let stat = "";
      const templateData = {
        details: this.system.description,
        moveResults: this.system.moveResults,
        choices: this.system?.choices,
        sheetType: this.actor?.baseType,
        resultRangeNeeded: this.type === 'move',
        rollType: this.system.rollType.toLowerCase(),
      };
      if ((this.type == 'move' || this.type == 'npcMove')) {
        // Get the roll stat for moves.
        if (this.type == 'npcMove' || this.system?.rollType == 'formula') {
          formula = this.system.rollFormula;
          templateData.rollType = this.system.rollType ? this.system.rollType.toLowerCase() : 'npc';
        }
        // Add result ranges for moves.
        if (this.type == 'move') {
          templateData.rollType = 'move';
        }

        if (!['ask', 'prompt', 'formula'].includes(this.system.rollType)) {
          stat = this.system.rollType;
          if (this.actor.system.stats[this.system.rollType].toggle) {
            formula += " + 0";
          } else {
            formula += ` + @stats.${this.system.rollType}.value`;
          }
        }
        if (this.system?.rollMod) {
          formula += ` + @rollMod`;
        }
      }
      const r = new RollPbtA(formula, this.getRollData(), foundry.utils.mergeObject(options, {
        resultRangeNeeded: this.type === 'move',
        rollType: this.type,
        sheetType: this.actor?.baseType,
        stat
      }));
      const choice = await r.configureDialog({
        templateData,
        title: game.i18n.format('PBTA.RollLabel', { label: this.name })
      });
      if (choice === null) return;
      await r.toMessage({
        image: this.img,
        title: this.name
      });
      await this.actor?.clearForwardAdv();
      await this.actor.updateCombatMoveCount();
    }
  }

  /** @inheritdoc */
  async _preCreate(data, options, userId) {
    await super._preCreate(data, options, userId);

    if (this.type == 'move' || this.type == 'npcMove') {
      const templateData = duplicate(this)
      if (!templateData.system) templateData.system = {};

      let resultRanges = game.pbta.sheetConfig.rollResults;
      if (!templateData.system.moveResults) {
        templateData.system.moveResults = {};
      }

      for (let [key, value] of Object.entries(resultRanges)) {
        if (!templateData.system.moveResults[key]) {
          templateData.system.moveResults[key] = {
            key: `system.moveResults.${key}.value`,
            label: value.label,
            value: ''
          };
        }
      }
      this.updateSource({
        system: mergeObject(templateData.system, this.toObject(false).system)
      });
    }
  }
}