import { PbtaUtility } from "./utility.js";

export class PbtaRolls {

  constructor() {
    this.actor = null;
    this.actorData = null;
  }

  static getRollFormula(defaultFormula = '2d6') {
    return game.pbta.sheetConfig.rollFormula ?? defaultFormula;
  }

  static async rollMove(options = {}) {
    let dice = this.getRollFormula('2d6');

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
      if (item.type == 'move') {
        formula = dice;
        templateData = {
          title: item.name,
          trigger: null,
          details: item.data.description,
          moveResults: item.data.moveResults
        };
        data.roll = item.data.rollType.toLowerCase();
        data.mod = item.data.rollMod;
        // If this is an ASK roll, render a prompt first to determine which
        // score to use.
        if (data.roll == 'ask') {
          let stats = game.pbta.sheetConfig.actorTypes[actorType].stats;
          let statButtons = Object.entries(stats).map(stat => {
            return {
              label: stat[1].label,
              callback: () => this.rollMoveExecute(stat[0], data, templateData)
            };
          });
          new Dialog({
            title: `Choose a stat`,
            content: `<p>Choose a stat for this <strong>${item.name}</strong> move.</p>`,
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
              title: `Enter your modifier`,
              content: html,
              buttons: {
                submit: {
                  label: 'Roll',
                  callback: html => {
                    this.rollMoveExecute('prompt', data, templateData, html[0].querySelector("form"))
                  }
                }
              }
            }).render(true);
          })

        }
        // Otherwise, grab the data from the move and pass it along.
        else {
          this.rollMoveExecute(data.roll.toLowerCase(), data, templateData);
        }
      }
      // Handle equipment.
      else if (item.type == 'equipment') {
        templateData = {
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

  static async rollMoveExecute(roll, dataset, templateData, form = null) {
    // Render the roll.
    let template = 'systems/pbta/templates/chat/chat-move.html';
    let dice = PbtaUtility.getRollFormula('2d6');
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
        validRoll = new Roll(roll.trim()).evaluate();
      } catch (error) {
        validRoll = false;
      }
      // Roll can be either a formula like `2d6+3` or a raw stat like `str`.
      let formula = validRoll ? roll.trim() : '';
      // Handle prompt (user input).
      if (!validRoll) {
        if (roll.toLowerCase() == 'prompt') {
          formula = form.prompt?.value ? `${dice}+${form.prompt.value}` : dice;
          if (dataset.value && dataset.value != 0) {
            formula += `+${dataset.value}`;
          }
        }
        // Handle ability scores (no input).
        else if (roll.match(/(\d*)d\d+/g)) {
          formula = roll;
        }
        // Handle moves.
        else {
          formula = `${dice}+${this.actorData.stats[roll].value}`;
          if (dataset.value && dataset.value != 0) {
            formula += `+${dataset.value}`;
          }
        }
      }
      if (formula != null) {
        // Do the roll.
        let roll = new Roll(`${formula}`, this.actor.getRollData());
        roll.roll();
        let rollType = templateData.rollType ?? 'move';
        // Add success notification.
        if (formula.includes(dice) && rollType == 'move') {
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
          templateData.resultDetails = templateData.moveResults[resultType]?.value ?? null;
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
        let moveCount = combatant.flags.pbta ? combatant.flags.pbta.moveCount : 0;
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
  }
}