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

    if (!options.actor) {
      return false;
    }

    if (!options.formula || !options.data) {
      return false;
    }

    this.actor = options.actor;
    this.actorData = this.actor ? this.actor.data.data : {};

    const item = options?.data;
    const itemData = item ? item?.data : null;

    let formula = options.formula ?? null;

    let templateData = {};
    let data = {};

    console.log('TEST!');

    // Handle item rolls (moves).
    if (item) {
      if (item.type == 'move') {
        formula = dice;
        templateData = {
          title: item.name,
          trigger: null,
          details: item.data.description
        };
        data.roll = item.data.rollType.toLowerCase();
        data.mod = item.data.rollMod;
        // If this is an ASK roll, render a prompt first to determine which
        // score to use.
        if (data.roll == 'ask') {
          let statButtons = Object.entries(game.pbta.stats).map(stat => {
            return {
              label: stat[1],
              callback: () => this.executeRoll(stat[0], data, templateData)
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
                    this.executeRoll('prompt', data, templateData, html[0].querySelector("form"))
                  }
                }
              }
            }).render(true);
          })

        }
        // Otherwise, grab the data from the move and pass it along.
        else {
          this.executeRoll(data.roll.toLowerCase(), data, templateData);
        }
      }
      else if (item.type == 'equipment') {
        templateData = {
          title: item.name,
          trigger: null,
          details: item.data.description,
          tags: item.data.tags
        }
        data.roll = null;
        this.executeRoll(data.roll, data, templateData);
      }
    }
    // Handle formula-only rolls.
    else {
      this.executeRoll(formula, data, templateData);
    }
  }

  async executeRoll(roll, dataset, templateData, form = null) {
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
      let validRoll = new Roll(roll.trim()).evaluate();
      // Roll can be either a formula like `2d6+3` or a raw stat like `str`.
      let formula = validRoll ? roll.trim() : '';
      // Handle prompt (user input).
      if (!validRoll) {
        if (roll == 'PROMPT') {
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