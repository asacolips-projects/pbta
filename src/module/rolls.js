import { PbtaUtility } from "./utility.js";

export class PbtaRolls {

  constructor() {
    this.actor = null;
    this.actorData = null;
  }

  /**
   * Retrieve the roll formula.
   *
   * @param {string} defaultFormula | Dice formula to use for rolls as a fallback.
   * @param {object|null} actor | (optional) Actor object to check for roll overrides.
   * @returns
   */
  static getRollFormula(defaultFormula = '2d6', actor = null) {
    // Get the default formula.
    let formula = game.pbta.sheetConfig.rollFormula ?? defaultFormula;
    // Check if the actor has an override formula.
    if (!actor && this.actor) actor = this.actor;
    if (actor && actor?.data?.data?.resources?.rollFormula?.value) {
      let validRoll = new Roll(actor.data.data.resources.rollFormula.value.trim(), actor.getRollData()).evaluate();
      if (validRoll) {
        formula = actor.data.data.resources.rollFormula.value.trim();
      }
    }
    // Return the final formula.
    return formula;
  }

  /**
   * Retrieve forward and ongoing stats as a string to be appended to rolls.
   *
   * @param {object} actor | Actor object to retrieve forward and ongoing modifiers for.
   * @returns
   */
  static getModifiers(actor) {
    let forward = Number(actor.data.data.resources.forward.value) ?? 0;
    let ongoing = Number(actor.data.data.resources.ongoing.value) ?? 0;
    let result = '';
    if (forward) result += `+${forward}`;
    if (ongoing) result += `+${ongoing}`;
    return result;
  }

  /**
   * Roll a move.
   *
   * Plain example:
   * let templateData = {
   *   title: 'My Move Name',
   *   resultRangeNeeded: true
   * };
   * let actor = game.actors.getName('My Actor');
   * let formula = '2d6+4';
   * PbtaRolls.rollMove({actor: actor, data: null, formula: formula, templateData: templateData});
   *
   * Item example:
   * let actor = game.actors.getName('My Actor');
   * let item = actor.items.find(i => i.name == 'My Item');
   * PbtaRolls.rollMove({actor: actor, data: item.data});
   *
   * @param {object} options
   * @param {object} options.actor | Actor to perform the roll for.
   * @param {object} options.formula | Roll formula to use, if supplying one manually.
   * @param {object} options.data | Item data to use instead of a formula.
   * @param {object} options.templateData | Object to pass when rendering the template.
   * @returns
   */
  static async rollMove(options = {}) {
    // TODO: Create a way to resolve this using the formula only, sans actor.
    // If there's no actor, we need to exit.
    if (!options.actor) {
      return false;
    }

    // If there's no formula or item, we need to exit.
    if (!options.formula && !options.data) {
      return false;
    }

    // Grab the actor data.
    this.actor = options.actor;
    this.actorData = this.actor ? this.actor.data.data : {};
    let actorType = this.actor.data.type;

    // Get the roll formula.
    let dice = this.getRollFormula('2d6', this.actor);

    // Grab the item data, if any.
    const item = options?.data;
    const itemData = item ? item?.data : null;

    // Grab the formula, if any.
    let formula = options.formula ?? null;
    let label = options?.data?.label ?? '';

    // Prepare template data for the roll.
    let templateData = options.templateData ? duplicate(options.templateData): {};
    let data = {};

    // Handle item rolls (moves).
    if (item) {
      // Handle moves.
      if (item.type == 'move' || item.type == 'npcMove') {
        formula = dice;
        templateData = {
          image: item.img,
          title: item.name,
          trigger: null,
          details: item.data.description,
          moveResults: item.data.moveResults,
          choices: item.data?.choices
        };

        if (item.type == 'npcMove' || item.data?.rollType == 'formula') {
          data.roll = item.data.rollFormula;
          data.rollType = item.data.rollType ? item.data.rollType.toLowerCase() : 'npc';
        }
        else {
          data.roll = item.data.rollType.toLowerCase();
          data.rollType = item.data.rollType.toLowerCase();
        }

        data.mod = item.type == 'move' ? item.data.rollMod : 0;
        // If this is an ASK roll, render a prompt first to determine which
        // score to use.
        if (data.roll == 'ask') {
          let stats = game.pbta.sheetConfig.actorTypes[actorType].stats;
          let statButtons = Object.entries(stats).filter(stat => stat[0] != 'ask' && stat[0] != 'prompt').map(stat => {
            return {
              label: stat[1].label,
              callback: () => this.rollMoveExecute(stat[0], data, templateData)
            };
          });
          new Dialog({
            title: game.i18n.localize('PBTA.AskTitle'),
            content: `<p>${game.i18n.localize('PBTA.Dialog.Ask1')} <strong>${item.name}</strong> ${game.i18n.localize('PBTA.Dialog.Ask2')}.</p>`,
            buttons: statButtons
          }).render(true);
        }
        // If this is a PROMPT roll, render a different prompt to let the user
        // enter their bond value.
        else if (data.roll == 'prompt') {
          let template = 'systems/pbta/templates/chat/roll-dialog.html';
          let dialogData = {
            title: item.name,
            bond: null
          };
          const html = await renderTemplate(template, dialogData);
          return new Promise(resolve => {
            new Dialog({
              title: game.i18n.localize('PBTA.PromptTitle'),
              content: html,
              buttons: {
                submit: {
                  label: 'Roll',
                  callback: html => {
                    this.rollMoveExecute('prompt', data, templateData, html[0].querySelector("form"))
                  }
                }
              },
              // Prevent enter triggering a refresh.
              render: html => {
                html.on('keydown', function(event) {
                  if (event.key == 'Enter') {
                    event.preventDefault();
                    html.find('button.submit').trigger('click');
                  }
                });
              }
            }).render(true);
          })

        }
        // Otherwise, grab the data from the move and pass it along.
        else {
          this.rollMoveExecute(data.roll, data, templateData);
        }
      }
      // Handle equipment.
      else if (item.type == 'equipment') {
        templateData = {
          image: item.img,
          title: item.name,
          trigger: null,
          details: item.data.description,
          tags: item.data.tags
        }
        data.roll = null;
        this.rollMoveExecute(data.roll, data, templateData);
      }
    }
    // Handle formula-only rolls.
    else {
      this.rollMoveExecute(formula, data, templateData);
    }
  }

  /**
   * Execute a roll
   *
   * @param {string} roll | Roll formula or stat name, e.g. '2d6+2' or 'cool'
   * @param {object} dataset | Cleaned up item data passed to the roll
   * @param {object} templateData | Template data passed to the template
   * @param {object} form | HTML element if this used the ask or prompt forms.
   */
  static async rollMoveExecute(roll, dataset, templateData, form = null) {
    // Render the roll.
    let template = 'systems/pbta/templates/chat/chat-move.html';
    let dice = this.getRollFormula('2d6', this.actor);
    let forwardUsed = false;
    let rollModeUsed = false;
    let resultRangeNeeded = templateData.resultRangeNeeded ?? false;
    let rollData = this.actor.getRollData();
    // GM rolls.
    let chatData = {
      user: game.user._id,
      speaker: ChatMessage.getSpeaker({ actor: this.actor })
    };
    let rollMode = game.settings.get("core", "rollMode");
    if (["gmroll", "blindroll"].includes(rollMode)) chatData["whisper"] = ChatMessage.getWhisperRecipients("GM");
    if (rollMode === "selfroll") chatData["whisper"] = [game.user._id];
    if (rollMode === "blindroll") chatData["blind"] = true;
    // Handle dice rolls.
    if (!PbtaUtility.isEmpty(roll)) {
      // Test if the roll is a formula.
      let validRoll = false;
      try {
        validRoll = new Roll(roll.trim(), rollData).evaluate();
      } catch (error) {
        validRoll = false;
      }
      // Roll can be either a formula like `2d6+3` or a raw stat like `str`.
      let formula = validRoll ? roll.trim() : '';
      // Handle prompt (user input).
      if (!validRoll || dataset?.rollType == 'formula') {
        if (roll.toLowerCase() == 'prompt') {
          formula = form.prompt?.value ? `${dice}+${form.prompt.value}` : dice;
          if (dataset.value && dataset.value != 0) {
            formula += `+${dataset.value}`;
          }
        }
        else if (dataset?.rollType == 'formula') {
          formula = roll;
        }
        // Handle ability scores (no input).
        else if (roll.match(/(\d*)d\d+/g)) {
          formula = roll;
        }
        // Handle moves.
        else {
          // Determine if the stat toggle is in effect.
          let hasToggle = game.pbta.sheetConfig.statToggle;
          let toggleModifier = 0;
          if (hasToggle) {
            const statToggle = this.actor.data.data.stats[roll].toggle;
            toggleModifier = statToggle ? game.pbta.sheetConfig.statToggle.modifier : 0;
          }
          formula = `${dice}+${this.actorData.stats[roll].value}${toggleModifier ? '+' + toggleModifier : ''}`;
          if (dataset.value && dataset.value != 0) {
            formula += `+${dataset.value}`;
          }
        }

        // Handle adv/dis.
        let rollMode = this.actor.data.flags?.pbta?.rollMode ?? 'def';
        switch (rollMode) {
          case 'adv':
            rollModeUsed = true;
            if (formula.includes('2d6')) {
              formula = formula.replace('2d6', '3d6kh2');
            }
            else if (formula.includes('d')) {
              // Match the first d6 as (n)d6.
              formula = formula.replace(/(\d*)(d)(\d+)/i, (match, p1, p2, p3, offset, string) => {
                let keep = p1 ? Number(p1) : 1;
                let count = keep + 1;
                return `${count}${p2}${p3}kh${keep}`; // Ex: 2d6 -> 3d6kh2
              });
            }
            break;

          case 'dis':
            rollModeUsed = true;
            if (formula.includes('2d6')) {
              formula = formula.replace('2d6', '3d6kl2');
            }
            else if (formula.includes('d')) {
              // Match the first d6 as (n)d6.
              formula = formula.replace(/(\d*)(d)(\d+)/i, (match, p1, p2, p3, offset, string) => {
                let keep = p1 ? Number(p1) : 1;
                let count = keep + 1;
                return `${count}${p2}${p3}kl${keep}`; // Ex: 2d6 -> 3d6kh2
              });
            }
            break;
        }

        if (this.actor.data.data?.resources?.forward?.value || this.actor.data.data?.resources?.ongoing?.value) {
          let modifiers = PbtaRolls.getModifiers(this.actor);
          formula = `${formula}${modifiers}`;
          if (this.actor.data.data?.resources?.forward?.value) {
            forwardUsed = Number(this.actor.data.data.resources.forward.value) != 0;
          }
        }
        resultRangeNeeded = true;
      }
      if (formula != null) {
        // Do the roll.
        let roll = new Roll(`${formula}`, rollData);
        await roll.evaluate({async: true});
        let rollType = templateData.rollType ?? 'move';
        // Handle moves that need result ranges but were missed.
        if (!resultRangeNeeded && templateData?.moveResults && typeof templateData.moveResults == 'object') {
          let tempResultRanges = Object.entries(templateData.moveResults);
          for (let [resultKey, resultRange] of tempResultRanges) {
            if (resultRange.value) {
              resultRangeNeeded = true;
              break;
            }
          }
        }
        // Add success notification.
        if (resultRangeNeeded && rollType == 'move') {
          // Retrieve the result ranges.
          let resultRanges = game.pbta.sheetConfig.rollResults;
          let resultType = null;
          // Iterate through each result range until we find a match.
          for (let [resultKey, resultRange] of Object.entries(resultRanges)) {
            // Grab the start and end.
            let start = resultRange.start;
            let end = resultRange.end;
            // If both are present, roll must be between them.
            if (start && end) {
              if (roll.total >= start && roll.total <= end) {
                resultType = resultKey;
                break;
              }
            }
            // If start only, treat it as greater than or equal to.
            else if (start) {
              if (roll.total >= start) {
                resultType = resultKey;
                break;
              }
            }
            // If end only, treat it as less than or equal to.
            else if (end) {
              if (roll.total <= end) {
                resultType = resultKey;
                break;
              }
            }
          }

          // Update the templateData.
          templateData.resultLabel = resultRanges[resultType]?.label ?? resultType;
          templateData.result = resultType;
          templateData.resultDetails = null;
          if (templateData?.moveResults && templateData.moveResults[resultType]?.value) {
            templateData.resultDetails = templateData.moveResults[resultType].value;
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

    // Update the combat flags.
    if (game.combat && game.combat.combatants) {
      let combatant = game.combat.combatants.find(c => c.actor.data._id == this.actor._id);
      if (combatant) {
        let flags = CONFIG.PBTA.core8x ? combatant.data.flags : combatant.flags;
        let moveCount = flags.pbta ? flags.pbta.moveCount : 0;
        moveCount = moveCount ? Number(moveCount) + 1 : 1;
        // Emit a socket for the GM client.
        if (!game.user.isGM) {
          game.socket.emit('system.pbta', {
            combatantUpdate: { _id: combatant._id, 'flags.pbta.moveCount': moveCount }
          });
        }
        else {
          await game.combat.updateCombatant({ _id: combatant._id, 'flags.pbta.moveCount': moveCount });
          ui.combat.render();
        }
      }
    }

    // Update forward.
    if (forwardUsed || rollModeUsed) {
      let updates = {};
      if (forwardUsed) updates['data.resources.forward.value'] = 0;
      if (rollModeUsed && game.settings.get('pbta', 'advForward')) {
        updates['flags.pbta.rollMode'] = 'def';
      }
      await this.actor.update(updates);
    }
  }
}