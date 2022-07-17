import { PbtaActorTemplates } from '../pbta/pbta-actors.js';
import { PbtaUtility } from '../utility.js';
import { PbtaActorNpcSheet } from './actor-npc-sheet.js';

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

    const actorData = this;
    const data = actorData.system;
    const flags = actorData.flags;

    if (actorData.type === 'character') this._prepareCharacterData(actorData);
  }

  /**
   * Prepare Character type specific data
   */
  _prepareCharacterData(actorData) {
    // Handle special attributes.
    let groups = [
      'attrTop',
      'attrLeft'
    ];
    for (let group of groups) {
      for (let [attrKey, attrValue] of Object.entries(actorData.system[group])) {
        // ListMany field handling.
        if (attrValue.type == 'ListMany') {
          // Iterate over options.
          for (let [optK, optV] of Object.entries(attrValue.options)) {
            // If there's a multi-value field, we need to propagate its value up
            // to the parent `value` property.
            if (optV.values) {
              // Set up some tracking variables for the loop.
              let loopFinished = false;
              let loopStep = 0;
              let optArray = Object.values(optV.values);
              // Iterate over suboptions.
              for (let subOpt of optArray) {
                // If any option is true, set the value and exit.
                if (subOpt.value) {
                  optV.value = true;
                  break;
                }
                // On the last step, mark that we finished.
                if (loopStep == optArray.length - 1) {
                  loopFinished = true;
                }
                loopStep++;
              }
              // If the loop finished, all possible values were false. Mark this
              // attribute as false as well.
              if (loopFinished) {
                optV.value = false;
              }
            }
          }
        }
      }
    }
  }

  /**
   * Listen for click events on rollables.
   * @param {MouseEvent} event
   */
  async _onRoll(event, actor = null) {
    actor = !actor ? this.actor : actor;

    // Initialize variables.
    event.preventDefault();

    if (!actor) {
      return;
    }

    const a = event.currentTarget;
    const data = a.dataset;
    const actorData = actor.system;
    const itemId = $(a).parents('.item').attr('data-item-id');
    const item = actor.items.get(itemId);
    let formula = null;
    let titleText = null;
    let flavorText = null;
    let templateData = {};
    let dice = PbtaUtility.getRollFormula('2d6');

    // Handle rolls coming directly from the ability score.
    if ($(a).hasClass('ability-rollable') && data.mod) {
      formula = `${dice}+${data.mod}`;
      flavorText = data.label;
      if (data.debility) {
        flavorText += ` (${data.debility})`;
      }

      templateData = {
        title: flavorText
      };

      this.rollMove(formula, actor, data, templateData);
    }
    else if ($(a).hasClass('damage-rollable') && data.roll) {
      formula = data.roll;
      titleText = data.label;
      flavorText = data.flavor;
      templateData = {
        title: titleText,
        flavor: flavorText
      };

      this.rollMove(formula, actor, data, templateData, null, true);
    }
    else if (itemId != undefined) {
      item.roll();
    }
  }

  /**
   * Roll a move and use the chat card template.
   * @param {Object} templateData
   */
  async rollMove(roll, actor, dataset, templateData, form = null, applyDamage = false) {
    let actorData = actor.system;
    // Render the roll.
    let template = 'systems/pbta/templates/chat/chat-move.html';
    let dice = PbtaUtility.getRollFormula('2d6');
    // GM rolls.
    let chatData = {
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: actor })
    };
    let rollMode = game.settings.get("core", "rollMode");
    if (["gmroll", "blindroll"].includes(rollMode)) chatData["whisper"] = ChatMessage.getWhisperRecipients("GM");
    if (rollMode === "selfroll") chatData["whisper"] = [game.user.id];
    if (rollMode === "blindroll") chatData["blind"] = true;
    // Handle dice rolls.
    if (roll) {
      // Roll can be either a formula like `2d6+3` or a raw stat like `str`.
      let formula = '';
      // Handle bond (user input).
      if (roll == 'BOND') {
        formula = form.bond.value ? `${dice}+${form.bond.value}` : dice;
        if (dataset.mod && dataset.mod != 0) {
          formula += `+${dataset.mod}`;
        }
      }
      // Handle ability scores (no input).
      else if (roll.match(/(\d*)d\d+/g)) {
        formula = roll;
      }
      // Handle moves.
      else {
        formula = `${dice}+${actorData.abilities[roll].mod}`;
        if (dataset.mod && dataset.mod != 0) {
          formula += `+${dataset.mod}`;
        }
      }
      if (formula != null) {
        // Do the roll.
        let roll = new Roll(`${formula}`, actor.getRollData());
        await roll.evaluate({async: true});
        // Add success notification.
        if (formula.includes(dice)) {
          if (roll.total < 7) {
            templateData.result = 'failure';
          }
          else if (roll.total > 6 && roll.total < 10) {
            templateData.result = 'partial';
          }
          else {
            templateData.result = 'success';
          }
        }
        // Render it.
        roll.render().then(r => {
          templateData.rollPbta = r;
          renderTemplate(template, templateData).then(content => {
            chatData.content = content;
            if (game.dice3d) {
              game.dice3d.showForRoll(roll, game.user, true, chatData.whisper, chatData.blind).then(displayed => ChatMessage.create(chatData));
            }
            else {
              chatData.sound = CONFIG.sounds.dice;
              ChatMessage.create(chatData);
            }
          });
        });
      }
    }
    else {
      renderTemplate(template, templateData).then(content => {
        chatData.content = content;
        ChatMessage.create(chatData);
      });
    }
  }


  /** @inheritdoc */
  async _preCreate(data, options, userId) {
    await super._preCreate(data, options, userId);

    let actor = this;
    let templateData = PbtaActorTemplates.applyActorTemplate(actor, options, null);
    // @todo v10
    this.updateSource({system: templateData});
  }
}