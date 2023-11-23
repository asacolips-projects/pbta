import { PbtaActorTemplates } from '../pbta/pbta-actors.js';
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
          } else if (roll.total > 6 && roll.total < 10) {
            templateData.result = 'partial';
          } else {
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

  static async createDialog(data={}, {parent=null, pack=null, ...options}={}) {
    const documentName = this.metadata.name;
    const types = Object.keys(game.pbta.sheetConfig.actorTypes);
    let collection;
    if ( !parent ) {
      if ( pack ) collection = game.packs.get(pack);
      else collection = game.collections.get(documentName);
    }
    const folders = collection?._formatFolderSelectOptions() ?? [];
    const label = game.i18n.localize(this.metadata.label);
    const title = game.i18n.format("DOCUMENT.Create", {type: label});
    // Render the document creation form
    const html = await renderTemplate("templates/sidebar/document-create.html", {
      folders,
      name: data.name || game.i18n.format("DOCUMENT.New", {type: label}),
      folder: data.folder,
      hasFolders: folders.length >= 1,
      type: data.type || CONFIG[documentName]?.defaultType || types[0],
      types: types.reduce((obj, t) => {
        const pbtaLabel = game.pbta.sheetConfig.actorTypes[t].label;
        const label = CONFIG[documentName]?.typeLabels?.[t] ?? t;
        if (pbtaLabel) {
          obj[t] = pbtaLabel;
        } else {
          obj[t] = game.i18n.has(label) ? game.i18n.localize(label) : t;
        }
        return obj;
      }, {}),
      hasTypes: types.length > 1
    });

    // Render the confirmation dialog window
    return Dialog.prompt({
      title: title,
      content: html,
      label: title,
      callback: html => {
        const form = html[0].querySelector("form");
        const fd = new FormDataExtended(form);
        foundry.utils.mergeObject(data, fd.object, {inplace: true});
        if ( !data.folder ) delete data.folder;
        if ( types.length === 1 ) data.type = types[0];
        if ( !data.name?.trim() ) data.name = this.defaultName();

        // First we need to find the base actor type to model this after.
        if (!['character', 'npc'].includes(data.type)) {
          data.system = {
            customType: data.type
          }
          data.type = 'other';
        }

        return this.create(data, {parent, pack, renderSheet: true});
      },
      rejectClose: false,
      options
    });
  }
}