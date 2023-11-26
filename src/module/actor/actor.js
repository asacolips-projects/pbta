import { PbtaActorTemplates } from '../pbta/pbta-actors.js';
import { RollPbtA } from "../rolls.js";
import { PbtaUtility } from '../utility.js';

/**
 * Extends the basic Actor class for Powered by the Apocalypse.
 * @extends {Actor}
 */
export class ActorPbta extends Actor {
  /**
   * Augment the basic actor data with additional dynamic data.
   */
  prepareData() {
    super.prepareData();
    // Handle actor types.
    if (this.baseType === 'character') this._prepareCharacterData();
  }

  get sheetType() {
    return this.system?.customType ?? null;
  }

  get baseType() {
    return game.pbta.sheetConfig.actorTypes[this.sheetType]?.baseType
      ?? (this.type === 'other' ? 'character' : this.type);
  }

  /**
   * Prepare Character type specific data
   */
  _prepareCharacterData() {
    // Handle special attributes.
    let groups = [
      'attrTop',
      'attrLeft'
    ];
    for (let group of groups) {
      for (let [attrKey, attrValue] of Object.entries(this.system[group])) {
        // ListMany field handling.
        if (['ListOne', 'ListMany'].includes(attrValue.type) && attrValue.options) {
          // Iterate over options.
          for (let optV of Object.values(attrValue.options)) {
            // If there's a multi-value field, we need to propagate its value up
            // to the parent `value` property.
            if (optV.values) {
              const optArray = Object.values(optV.values);
              optV.value = optArray.some(subOpt => subOpt.value);
            }
          }
        }
      }
    }
  }

  /**
   * Override getRollData() that's supplied to rolls.
   */
  getRollData() {
    const data = super.getRollData();
    data.formula = this.getRollFormula();
    return data;
  }

  getRollFormula(defaultFormula = '2d6') {
    const rollFormula = this.system?.resources?.rollFormula?.value;
    if (rollFormula && Roll.validate(rollFormula)) {
      return rollFormula.trim()
    }
    return game.pbta.sheetConfig.rollFormula ?? defaultFormula;
  }

  async clearForwardAdv() {
    const forwardUsed = this.system?.resources?.forward?.value;
    const rollModeUsed = this.getFlag("pbta", "rollMode") !== 'def';
    if (forwardUsed || rollModeUsed) {
      const updates = {};
      if (forwardUsed) {
        updates['system.resources.forward.value'] = 0;
      }
      if (rollModeUsed && game.settings.get('pbta', 'advForward')) {
        updates['flags.pbta.rollMode'] = 'def';
      }
      await this.update(updates);
    }
  }

  async updateCombatMoveCount() {
    if (game.combat && game.combat.combatants) {
      let combatant = game.combat.combatants.find((c) => c.actor.id == this.id);
      if (combatant) {
        let moveCount = combatant.getFlag("pbta", "moveCount") ?? 0;
        moveCount = moveCount ? Number(moveCount) + 1 : 1;
        let combatantUpdate = {
          _id: combatant.id,
          'flags.pbta.moveCount': moveCount
        };
        // Emit a socket for the GM client.
        if (!game.user.isGM) {
          game.socket.emit('system.pbta', {
            combatantUpdate: combatantUpdate
          });
        }
        else {
          let combatantUpdates = [];
          combatantUpdates.push(combatantUpdate);
          await game.combat.updateEmbeddedDocuments('Combatant', combatantUpdates);
          ui.combat.render();
        }
      }
    }
  }

  /**
   * Listen for click events on rollables.
   * @param {MouseEvent} event
   */
  async _onRoll(event) {
    const { label, roll } = event.currentTarget.dataset;
    const a = event.currentTarget;
    const itemId = $(a).parents('.item').attr('data-item-id');
    const options = {
      rollMode: this.flags?.pbta?.rollMode
    }

    // Handle rolls coming directly from the ability score.
    if ($(a).hasClass('stat-rollable')) {
      let formula = "@formula";
      const stat = $(a).parents('.stat').data('stat') ?? null;
      if (stat) {
        if (this.system.stats[stat].toggle) {
          formula += "+ 0"
        } else {
          formula += `+ @stats.${stat}.value`;
        }
      }

      const roll = new RollPbtA(formula, this.getRollData(), foundry.utils.mergeObject(options, {
        resultRangeNeeded: true,
        rollType: 'stat',
        sheetType: this.baseType,
        stat
      }));
      const choice = await roll.configureDialog({
        title: game.i18n.format("PBTA.RollLabel", { label }),
      });
      if (choice === null) return;
      await roll.toMessage({
        title: label ?? ""
      });
      await this.clearForwardAdv();
      await this.updateCombatMoveCount();
    } else if ($(a).hasClass('attr-rollable') && roll) {
      const r = new RollPbtA(roll, this.getRollData(), foundry.utils.mergeObject(options, {
        rollType: 'flat'
      }));
      const choice = await r.configureDialog({
        title: label,
      });
      if (choice === null) return;
      await r.toMessage();
    } else if (itemId) {
      const item = this.items.get(itemId);
      const descriptionOnly = a.getAttribute("data-show") === 'description'
      item.roll({ descriptionOnly }, options);
    }
  }

  /** @inheritdoc */
  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);
    const sourceId = this.getFlag("core", "sourceId");
    if (sourceId?.startsWith("Compendium.")) return;

    const changes = {
      system: PbtaActorTemplates.applyActorTemplate(this, options, null)
    }
    if (this.baseType === "character") {
      changes.prototypeToken = {
        actorLink: true,
        disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
      };
    }
    this.updateSource(changes);
  }
}