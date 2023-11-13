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
  static async getRollFormula(defaultFormula = '2d6', actor = null) {
    // Get the default formula.
    let formula = game.pbta.sheetConfig.rollFormula ?? defaultFormula;
    // Check if the actor has an override formula.
    if (!actor && this.actor) actor = this.actor;
    if (actor && actor?.system?.resources?.rollFormula?.value) {
      let validRoll = await new Roll(actor.system.resources.rollFormula.value.trim(), actor.getRollData()).evaluate({async: true});
      if (validRoll) {
        formula = actor.system.resources.rollFormula.value.trim();
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
    let forward = Number(actor.system.resources.forward.value) ?? 0;
    let ongoing = Number(actor.system.resources.ongoing.value) ?? 0;
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
   * PbtaRolls.rollMove({actor: actor, data: item});
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

    // Assume we don't need a prompt.
    let needsDialog = false;

    // Grab the actor data.
    this.actor = options.actor;
    this.actorData = this.actor ? this.actor.system : {};
    let actorType = this.actor.type;

    // Get the roll formula.
    let dice = await this.getRollFormula('2d6', this.actor);

    // Grab the item data, if any.
    const item = options?.data;
    const itemData = item ? item?.system : null;

    // Grab the formula, if any.
    let label = options?.data?.label ?? '';

    // Prepare template data for the roll.
    let templateData = options.templateData ? duplicate(options.templateData): {};
    let data = {};

    // Add the sheet type to the template data.
    let sheetType = this.actor.system?.customType ?? actorType;
    templateData.sheetType = sheetType;

    // Determine if there are any conditions.
    let attrs = Object.entries(this.actor.system.attrLeft).concat(Object.entries(this.actor.system.attrTop));
    let conditionGroups = attrs.filter(condition => condition[1].condition).map(condition => {
      return {
        key: condition[0],
        label: condition[1].label,
        conditions: Object.values(condition[1].options).filter(v => v.value && (v.userLabel ?? v.label).match(/\d/)).map(v => {
          let conditionLabel = v.userLabel ?? v.label;
          return {
            label: conditionLabel,
            mod: Roll.safeEval(conditionLabel.match(/[\d\+\-]/g).join(''))
          }
        })
      };
    });
    conditionGroups = conditionGroups.filter(c => c.conditions.length > 0);
    if (conditionGroups.length > 0 && item.system.rollType !== '') needsDialog = true;

    // Prepare the base set of options used for the roll dialog.
    let dialogOptions = {
      title: game.i18n.localize('PBTA.RollMove'),
      content: null,
      templateData: {
        title: null,
        bond: null,
        hasPrompt: false,
        content: null,
        conditionGroups: conditionGroups ?? null
      },
      buttons: {
        submit: {
          label: 'Roll',
          callback: html => {
            if (options.formula && options?.actor?.system?.stats[options.formula]) {
              templateData.stat = options.formula;
            }
            this.rollMoveExecute(options.formula ?? 'prompt', data, templateData, html[0].querySelector("form"))
          }
        }
      },
    };

    // Handle item rolls (moves).
    if (item) {
      // Handle moves.
      if ((item.type == 'move' || item.type == 'npcMove') && !options?.parameters?.descriptionOnly) {
        options.formula = dice;
        templateData = {
          image: item.img,
          title: item.name,
          trigger: null,
          details: item.system.description,
          moveResults: item.system.moveResults,
          choices: item.system?.choices,
          sheetType: sheetType
        };

        // Get the roll stat for moves.
        if (item.type == 'npcMove' || item.system?.rollType == 'formula') {
          data.roll = item.system.rollFormula;
          data.rollType = item.system.rollType ? item.system.rollType.toLowerCase() : 'npc';
        }
        else {
          data.roll = item.system.rollType.toLowerCase();
          data.rollType = item.system.rollType.toLowerCase();
        }

        // Add result ranges for moves.
        if (item.type == 'move') {
          templateData.resultRangeNeeded = true;
          templateData.rollType = 'move';
        }

        // Get the roll modifier on the move itself, if any.
        data.mod = item?.system?.rollMod ?? 0;

        // If this is an ASK roll, adjust the dialog options.
        if (data.roll == 'ask') {
          needsDialog = true;
          dialogOptions.title = game.i18n.format('PBTA.AskTitle');
          dialogOptions.templateData = {
            title: null,
            bond: null,
            hasPrompt: false,
            content: `<p>${game.i18n.localize('PBTA.Dialog.Ask1')} <strong>${item.name}</strong> ${game.i18n.localize('PBTA.Dialog.Ask2')}.</p>`,
            conditionGroups: conditionGroups ?? null
          };
          let stats = game.pbta.sheetConfig.actorTypes[sheetType].stats;
          dialogOptions.buttons = Object.entries(stats).filter(stat => stat[0] != 'ask' && stat[0] != 'prompt' && stat[0] != 'formula').map(stat => {
            return {
              label: stat[1].label,
              callback: html => {
                templateData.stat = stat[0];
                this.rollMoveExecute(stat[0], data, templateData, html[0].querySelector("form"));
              }
            };
          });
        }
        // If this is a PROMPT roll, adjust the dialog options.
        else if (data.roll == 'prompt') {
          needsDialog = true;
          dialogOptions.title = game.i18n.localize('PBTA.PromptTitle');
          dialogOptions.templateData = {
            title: item.name,
            bond: null,
            hasPrompt: true,
            conditionGroups: conditionGroups ?? null
          };
          options.formula = 'prompt';
        }
        // Otherwise, grab the data from the move and pass it along.
        else {
          options.formula = data.roll;
          templateData.stat = data.roll;
        }
      }
      // Handle equipment.
      else if (item.type == 'equipment' || options?.parameters?.descriptionOnly) {
        templateData = {
          image: item.img,
          title: item.name,
          trigger: null,
          details: item.system.description,
          tags: item.system.tags
        }
        // Equipment only output to chat and do not need rolls.
        data.roll = null;
        options.formula = null;
        needsDialog = false;
      }
    }
    // Ensure we have result ranges on raw stat rolls.
    else {
      let stats = this?.actor?.system?.stats;
      if (options.formula && typeof stats[options.formula] !== 'undefined') {
        templateData.resultRangeNeeded = true;
        templateData.rollType = 'move';
      }
    }

    // If this roll has conditions, ASK, or PROMPT, use a dialog.
    if (needsDialog) {
      const template = 'systems/pbta/templates/chat/roll-dialog.html';
      const html = await renderTemplate(template, dialogOptions.templateData);
      return new Promise(resolve => {
        new Dialog({
          title: dialogOptions.title,
          content: html,
          buttons: dialogOptions.buttons,
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
      });
    }
    // Otherwise, execute the roll immediately.
    else {
      this.rollMoveExecute(options.formula, data, templateData);
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
    let dice = await this.getRollFormula('2d6', this.actor);
    let forwardUsed = false;
    let rollModeUsed = false;
    let resultRangeNeeded = templateData.resultRangeNeeded ?? false;
    let rollData = this.actor.getRollData();
    let conditions = [];

    // GM rolls.
    let chatData = {
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: this.actor })
    };
    let rollMode = game.settings.get("core", "rollMode");
    if (["gmroll", "blindroll"].includes(rollMode)) chatData["whisper"] = ChatMessage.getWhisperRecipients("GM");
    if (rollMode === "selfroll") chatData["whisper"] = [game.user.id];
    if (rollMode === "blindroll") chatData["blind"] = true;

    // Handle dice rolls.
    if (!PbtaUtility.isEmpty(roll)) {
      // Test if the roll is a formula.
      let validRoll = false;
      try {
        validRoll = await new Roll(roll.trim(), rollData).evaluate({async: true});
      } catch (error) {
        validRoll = false;
      }

      // Roll can be either a formula like `2d6+3` or a raw stat like `str`.
      let formula = validRoll ? roll.trim() : '';
      // Handle prompt (user input).
      if (!validRoll || dataset?.rollType == 'formula') {

        // Determine the formula if this is a PROMPT roll.
        if (roll.toLowerCase() == 'prompt') {
          formula = form.prompt?.value ? `${dice}+${form.prompt.value}` : dice;
          if (dataset.value && dataset.value != 0) {
            formula += `+${dataset.value}`;
          }
        }
        // Determine the formula if it's a custom formula.
        else if (dataset?.rollType == 'formula') {
          formula = roll;
        }
        // Handle raw ability scores (no input).
        else if (roll.match(/(\d*)d\d+/g)) {
          formula = roll;
        }
        // Handle moves.
        else {
          // Determine if the stat toggle is in effect.
          let hasToggle = game.pbta.sheetConfig.statToggle;
          let toggleModifier = 0;
          templateData.stat = roll;
          if (hasToggle) {
            const statToggle = this.actor.system.stats[roll].toggle;
            toggleModifier = statToggle ? game.pbta.sheetConfig.statToggle.modifier : 0;
          }
          // Set the formula based on the stat.
          formula = `${dice}+${this.actorData.stats[roll].value}${toggleModifier ? '+' + toggleModifier : ''}`;
          if (dataset.value && dataset.value != 0) {
            formula += `+${dataset.value}`;
          }
        }

        // Handle modifiers on the move.
        if (dataset.mod) formula += Number(dataset.mod) >= 0 ? ` + ${dataset.mod}` : ` ${dataset.mod}`;

        // Handle conditions, if any.
        if (form?.condition) {
          if (form.condition?.length > 0) {
            for (let i = 0; i < form.condition.length; i++) {
              if (form.condition[i].checked) {
                let input = form.condition[i];
                let dataAttr = input.dataset;
                formula += dataAttr.mod >= 0 ? ` + ${dataAttr.mod}` : ` ${dataAttr.mod}`;
                conditions.push(dataAttr.content);
              }
            }
          }
          else if (form.condition.checked) {
            let input = form.condition;
            let dataAttr = input.dataset;
            formula += dataAttr.mod >= 0 ? ` + ${dataAttr.mod}` : ` ${dataAttr.mod}`;
            conditions.push(dataAttr.content);
          }
        }

        // Handle adv/dis. This works by finding the first die in the formula,
        // increasing its quantity by 1, and then appending kl or kh with the
        // original quantity.
        let rollMode = this.actor.flags?.pbta?.rollMode ?? 'def';
        switch (rollMode) {
          // Advantage.
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
            conditions.push(game.i18n.localize("PBTA.Advantage"));
            break;

          // Disadvantage.
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
            conditions.push(game.i18n.localize("PBTA.Disadvantage"));
            break;
        }

        // Handle forward and ongoing.
        if (this.actor.system?.resources?.forward?.value || this.actor.system?.resources?.ongoing?.value) {
          let modifiers = PbtaRolls.getModifiers(this.actor);
          formula = `${formula}${modifiers}`;
          if (this.actor.system?.resources?.forward?.value) {
            forwardUsed = Number(this.actor.system.resources.forward.value) != 0;
          }

          // Add labels for chat output.
          if (this.actor.system.resources.forward?.value) {
            let forward = Number(this.actor.system.resources.forward.value) ?? 0;
            conditions.push(`${game.i18n.localize('PBTA.Forward')} (${forward >= 0 ? '+' + forward : forward})`);
          }
          if (this.actor.system.resources.ongoing?.value) {
            let ongoing = Number(this.actor.system.resources.ongoing.value) ?? 0;
            conditions.push(`${game.i18n.localize('PBTA.Ongoing')} (${ongoing >= 0 ? '+' + ongoing : ongoing})`);
          }
        }

        // Establish that this roll is for a move or stat, so we need a result range.
        resultRangeNeeded = true;
      }


      if (formula != null) {
        // Hard-cap the modifiers if the system calls for it.
        let { minMod, maxMod } = game.pbta.sheetConfig;
        if (minMod || maxMod) {
          minMod ??= -Infinity;
          maxMod ??= Infinity;
          let [baseFormula, modifierString = "0"] = formula.split(/\+(.*)/s);
          // This should be a string of integers joined with + and -. This should be safe to eval.
          let originalMod = eval(modifierString);
          if (originalMod < minMod || originalMod > maxMod) {
            let totalMod = Math.clamped(originalMod, minMod, maxMod);
            formula = `${baseFormula}+${totalMod}`;
            templateData.originalMod = originalMod;
          }
        }

        // Catch wonky operators like "4 + - 3".
        formula = formula.replace(/\+\s*\-/g, '-');

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

        // If a result range is needed, add the result range template.
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

          // Add the stat label.
          if (templateData.stat && templateData.sheetType && this.actor.system.stats[templateData.stat]) {
            templateData.statMod = this.actor.system.stats[templateData.stat].value;
            templateData.stat = game.pbta.sheetConfig.actorTypes[templateData.sheetType]?.stats[templateData.stat]?.label ?? templateData.stat;
          }
        }

        // Remove stats if needed.
        if (!resultRangeNeeded) delete templateData.stat;

        // Add conditions for reference.
        if (conditions.length > 0) templateData.conditions = conditions;

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
    // If this isn't a roll, handle outputing the item description to chat.
    else {
      renderTemplate(template, templateData).then(content => {
        chatData.content = content;
        ChatMessage.create(chatData);
      });
    }

    // Update the combat flags.
    if (game.combat && game.combat.combatants) {
      let combatant = game.combat.combatants.find(c => c.actor.id == this.actor.id);
      if (combatant) {
        let flags = combatant.flags;
        let moveCount = flags.pbta ? flags.pbta.moveCount : 0;
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

    // Update forward.
    if (forwardUsed || rollModeUsed) {
      let updates = {};
      if (forwardUsed) updates['system.resources.forward.value'] = 0;
      if (rollModeUsed && game.settings.get('pbta', 'advForward')) {
        updates['flags.pbta.rollMode'] = 'def';
      }
      await this.actor.update(updates);
    }
  }
}
