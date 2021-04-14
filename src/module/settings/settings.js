import { PBTA } from "../config.js";
import { PbtaActorTemplates } from "../pbta/pbta-actors.js";
import { PbtaUtility } from "../utility.js";
import { codeMirrorAddToml } from './codemirror.toml.js';

export class PbtaSettingsConfigDialog extends FormApplication {
  /** @override */
	static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      title: game.i18n.localize("PBTA.Settings.sheetConfig.title"),
      id: "pbta-sheet-config",
      classes: ["pbta", "pbta-sheet-config"],
      template: "systems/pbta/templates/dialog/sheet-config.html",
      width: 720,
      height: 800,
      resizable: true,
      closeOnSubmit: true
    })
  }

  /* -------------------------------------------- */

  /** @override */
  async getData(options) {
    const data = await game.settings.get("pbta", "sheetConfig");
    if (!data.tomlString) {
      data.tomlString = '';
    }
    return data;
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html.find('button[name="reset"]').click(this._onResetDefaults.bind(this));
    // Load toml syntax. This is a failsafe in case other modules that use
    // CodeMirror (such as Custom CSS Rules) are enabled.
    if (!CodeMirror.modes.toml) {
      codeMirrorAddToml();
    }

    // Enable the CodeMirror code editor.
    this.codeEditor = CodeMirror.fromTextArea(html.find(".pbta-sheet-config")[0], {
      mode: "toml",
      indentUnit: 4,
      smartIndent: true,
      indentWithTabs: false,
      tabSize: 2,
      lineNumbers: true,
      inputStyle: "contenteditable",
      autofocus: true,
      theme: 'material-palenight'
  });
  }

  /**
   * Handles retrieving data from the form.
   *
   * @override Save the code editor instance before retrieving data to ensure the data is synchronised.
   *
   * @param {array} args - All arguments passed to this method, which will be forwarded to super
   * @return {object} The form data
   * @memberof SettingsForm
   */
  _getSubmitData(...args) {
    this.codeEditor.save();
    return super._getSubmitData(...args);
  }

  /* -------------------------------------------- */

  /**
   * Handle button click to reset default settings
   * @param event {Event}   The initial button click event
   * @private
   */
  async _onResetDefaults(event) {
    event.preventDefault();
    await game.settings.set("pbta", "sheetConfig", {});
    ui.notifications.info(game.i18n.localize('PBTA.Messages.sheetConfig.reset'));
    return this.render();
  }

  async close(options) {
    super.close(options);
    // window.location.reload();
  }

  /* -------------------------------------------- */

  /** @override */
  async _onSubmit(event, options) {
    // event.target.querySelectorAll("input[disabled]").forEach(i => i.disabled = false);
    // return super._onSubmit(event, options);
    super._onSubmit(event, options);
    window.location.reload();
  }

  /* -------------------------------------------- */

  /** @override */
  async _updateObject(event, formData) {
    let computed = {};
    let errors = [];

    if (formData.tomlString) {
      computed = toml.parse(formData.tomlString);
      errors = this.validateSheetConfig(computed);
    }
    else {
      errors = [game.i18n.localize('PBTA.Messages.sheetConfig.noConfig')];
    }

    if (errors.length > 0) {
      for (let error of errors) {
        ui.notifications.error(error, {permanent: true});
      }
      throw new Error(errors.join('\r\n'));
    }
    else {
      let confirm = true;
      if (game.pbta.sheetConfig?.actorTypes?.character && game.pbta.sheetConfig?.actorTypes?.npc) {
        confirm = await this.diffSheetConfig(computed);
      }
      if (!confirm) {
        throw new Error('Cancelled');
      }
      if (computed) {
        formData.computed = computed;
        // throw new Error('Test Error');
      }
      await game.settings.set("pbta", "sheetConfig", formData);
    }
  }

  /**
   * Validate sheetConfig settings and return errors.
   * @param {object} sheetConfig Computed sheetConfig settings.
   * @returns array
   */
  validateSheetConfig(sheetConfig) {
    let errors = [];
    const t = {
      'rollFormulaRequired': game.i18n.localize('PBTA.Messages.sheetConfig.rollFormulaRequired'),
      'rollResultsRequired': game.i18n.localize('PBTA.Messages.sheetConfig.rollResultsRequired'),
      'rollResultsIncorrect': game.i18n.localize('PBTA.Messages.sheetConfig.rollResultsIncorrect'),
      'actorTypeRequired': game.i18n.localize('PBTA.Messages.sheetConfig.actorTypeRequired'),
      'statString1': game.i18n.localize('PBTA.Messages.sheetConfig.statString1'),
      'statString2': game.i18n.localize('PBTA.Messages.sheetConfig.statString2'),
      'statsRequired1': game.i18n.localize('PBTA.Messages.sheetConfig.statsRequired1'),
      'statsRequired2': game.i18n.localize('PBTA.Messages.sheetConfig.statsRequired2'),
      'groupAttributes': game.i18n.localize('PBTA.Messages.sheetConfig.groupAttributes'),
      'attribute': game.i18n.localize('PBTA.Messages.sheetConfig.attribute'),
      'attributeType': game.i18n.localize('PBTA.Messages.sheetConfig.attributeType'),
      'attributeTypeNull': game.i18n.localize('PBTA.Messages.sheetConfig.attributeTypeNull'),
      'attributeMax': game.i18n.localize('PBTA.Messages.sheetConfig.attributeMax'),
      'attributeOptions': game.i18n.localize('PBTA.Messages.sheetConfig.attributeOptions'),
      'attributeOptionsEmpty': game.i18n.localize('PBTA.Messages.sheetConfig.attributeOptionsEmpty'),
      'moveTypes': game.i18n.localize('PBTA.Messages.sheetConfig.moveTypes'),
      'equipmentTypes': game.i18n.localize('PBTA.Messages.sheetConfig.equipmentTypes'),
    };

    // Handle rollFormula.
    if (!sheetConfig.rollFormula) {
      errors.push(`${t.rollFormulaRequired}`);
    }

    //  Handle rollResults.
    if (!sheetConfig.rollResults) {
      errors.push(`${t.rollResultsRequired}`);
    }
    if (typeof sheetConfig.rollResults != 'object' || Object.keys(sheetConfig.rollResults).length < 1) {
      errors.push(`${t.rollResultsIncorrect}`);
    }

    // Handle actor config.
    let actorTypes = ['character', 'npc'];
    if (game.pbta.sheetConfig.actorTypes) {
      for (let actorType of Object.keys(game.pbta.sheetConfig.actorTypes)) {
        if (!actorTypes.includes(actorType)) actorTypes.push(actorType);
      }
    }

    // Iterate through the actor types.
    for (let actorType of actorTypes) {
      // Error for missing actor type.
      if (!sheetConfig[actorType]) {
        errors.push(`'${actorType}' ${t.actorTypeRequired}`);
        continue;
      }

      // Store this in an easier to reference variable.
      let actorConfig = sheetConfig[actorType];

      // Validate stats.
      if (actorConfig.stats) {
        if (actorConfig.stats.length > 0) {
          for (let [k,v] of actorConfig.stats) {
            if (typeof v != 'string') {
              errors.push(`${t.statString1} "${k}" ${t.statString2}`);
            }
          }
        }
      }
      // Stats are required for characters (but not for NPCs).
      else {
        if (actorType == 'character' || actorConfig[actorType]?.baseType == 'character') {
          errors.push(`${t.statsRequired1} '${actorType}' ${t.statsRequired2}.`);
        }
      }

      // Validate attribute groups.
      let attrGroups = ['attributesTop', 'attributesLeft'];
      for (let attrGroup of attrGroups) {
        // If an attribute group is present, validate it.
        if (actorConfig[attrGroup]) {
          // Groups must be objects.
          if (typeof actorConfig[attrGroup] != 'object') {
            errors.push(`'${actorType}.${attrGroup}' ${t.groupAttributes}`);
          }
          else {
            // Iterate through each attribute.
            for (let [attr, attrValue] of Object.entries(actorConfig[attrGroup])) {
              // Confirm the attribute type is valid.
              let attrType = typeof attrValue == 'object' && attrValue.type ? attrValue.type : attrValue;
              if (!PBTA.attrTypes.includes(attrType)) {
                errors.push(`${t.attribute} '${actorType}.${attrGroup}.${attr}' ${t.attributeType} ${PBTA.attrTypes.join(', ')}.`);
              }

              if (typeof attrType == 'object') {
                errors.push(`${t.attribute} '${actorType}.${attrGroup}.${attr}' ${t.attributeTypeNull}`);
                continue;
              }

              // If this is a clock or XP, require a max value. Resources also
              // have a max prop, but those can be freely edited by the user and
              // are therefore not required.
              if (attrType == 'Clock' || attrType == 'Xp') {
                if (!attrValue.max) {
                  errors.push(`${t.attribute} '${actorType}.${attrGroup}.${attr}' ${t.attributeMax}`);
                }
              }

              // Handle list types.
              if (attrType == 'ListMany') {
                if (!attrValue.options) {
                  errors.push(`${t.attribute} '${actorType}.${attrGroup}.${attr}' ${t.attributeOptions}`);
                }
                else if (typeof attrValue.options != 'object' || Object.keys(attrValue.options).length < 1) {
                  errors.push(`${t.attribute} '${actorType}.${attrGroup}.${attr}' ${t.attributeOptionsEmpty}`);
                }
              }
            }
          }
        }
      }

      // Validate that the movetypes are included as an array.
      if (!actorConfig.moveTypes || typeof actorConfig.moveTypes != 'object' || Object.keys(actorConfig.moveTypes).length < 1) {
        errors.push(`'${actorType}.moveTypes' ${t.moveTypes}`);
      }

      // Validate that the movetypes are included as an array.
      if (actorConfig.equipmentTypes) {
        if (typeof actorConfig.equipmentTypes != 'object' || Object.keys(actorConfig.equipmentTypes).length < 1) {
          errors.push(`'${actorType}.equipmentTypes' ${t.equipmentTypes}`);
        }
      }
    }

    // Return the array of errors for output.
    return errors;
  }

  async diffSheetConfig(sheetConfig) {
    let currentConfig = game.pbta.sheetConfig;
    let duplicateConfig = duplicate(sheetConfig);
    let newConfig = PbtaUtility.convertSheetConfig(duplicateConfig);

    let configDiff = {
      'add': [],
      'del': [],
      'max': [],
      'softType': [],
      'hardType': [],
      'safe': []
    };
    let updatesDiff = {
      'character': {},
      'npc': {}
    };
    let actorTypes = ['character', 'npc'];
    if (game.pbta.sheetConfig.actorTypes) {
      for (let actorType of Object.keys(game.pbta.sheetConfig.actorTypes)) {
        if (!actorTypes.includes(actorType)) actorTypes.push(actorType);
        if (!updatesDiff[actorType]) updatesDiff[actorType] = {};
      }
    }
    let attrGroups = ['stats', 'attrLeft', 'attrTop', 'moveTypes', 'equipmentTypes'];

    for (let actorType of actorTypes) {
      for (let attrGroup of attrGroups) {
        if (!currentConfig.actorTypes[actorType][attrGroup]) {
          // configDiff.add.push(`${actorType}.${attrGroup}`);
          continue;
        }

        if (!newConfig.actorTypes[actorType][attrGroup]) {
          // configDiff.add.push(`${actorType}.${attrGroup}`);
          continue;
        }

        let newGroup = newConfig.actorTypes[actorType][attrGroup];
        let oldGroup = currentConfig.actorTypes[actorType][attrGroup];

        for (let attr of Object.keys(newGroup)) {
          if (!oldGroup[attr]) {
            configDiff.add.push(`${actorType}.${attrGroup}.${attr}`);
            updatesDiff[actorType][`data.${attrGroup}.${attr}`] = newGroup[attr];
          }
          else {
            // Handle updating label values.
            if (newGroup[attr].label && newGroup[attr].label != oldGroup[attr].label) {
              configDiff.safe.push(`${actorType}.${attrGroup}.${attr}.label`);
              updatesDiff[actorType][`data.${attrGroup}.${attr}.label`] = newGroup[attr].label;
            }
            if (newGroup[attr].customLabel && newGroup[attr].customLabel != oldGroup[attr].customLabel) {
              configDiff.safe.push(`${actorType}.${attrGroup}.${attr}.customLabel`);
              updatesDiff[actorType][`data.${attrGroup}.${attr}.customLabel`] = newGroup[attr].customLabel;
            }
            // Handle updating description values.
            if (newGroup[attr].description && newGroup[attr].description != oldGroup[attr].description) {
              configDiff.safe.push(`${actorType}.${attrGroup}.${attr}.description`);
              updatesDiff[actorType][`data.${attrGroup}.${attr}.description`] = newGroup[attr].description;
            }
          }
        }
        for (let attr of Object.keys(oldGroup)) {
          if (attr == 'ask' || attr == 'prompt' || attr == 'formula') {
            continue;
          }

          if (!newGroup[attr]) {
            configDiff.del.push(`${actorType}.${attrGroup}.${attr}`);
            updatesDiff[actorType][`data.${attrGroup}.-=${attr}`] = null;
          }
          else {
            // Handle updating max values.
            if (newGroup[attr].max && oldGroup[attr].max) {
              if (newGroup[attr].max != oldGroup[attr].max) {
                configDiff.max.push(`${actorType}.${attrGroup}.${attr}`);
                updatesDiff[actorType][`data.${attrGroup}.${attr}.max`] = newGroup[attr].max;
                updatesDiff[actorType][`data.${attrGroup}.${attr}.value`] = newGroup[attr].default ?? 0;

                // Handle types that have steps.
                if (newGroup[attr].steps) {
                  updatesDiff[actorType][`data.${attrGroup}.${attr}.steps`] = newGroup[attr].steps;
                }
                else {
                  updatesDiff[actorType][`data.${attrGroup}.${attr}.-=steps`] = null;
                }
              }
            }
            // Handle type changes.
            if (newGroup[attr].type && oldGroup[attr].type) {
              let newType = newGroup[attr].type;
              let oldType = oldGroup[attr].type;
              if (newType != oldType) {
                let resourceTypes = [
                  'Resource',
                  'Clock',
                  'Xp'
                ];

                let singleTypes = [
                  'Text',
                  'LongText',
                  'Number'
                ];

                if ((resourceTypes.includes(newType) && resourceTypes.includes(oldType) && oldType != 'Resource')
                || (singleTypes.includes(newType) && singleTypes.includes(oldType)) && newType != 'Number') {
                  configDiff.softType.push(`${actorType}.${attrGroup}.${attr}`);
                  updatesDiff[actorType][`data.${attrGroup}.${attr}.type`] = newGroup[attr].type;
                }
                else {
                  configDiff.hardType.push(`${actorType}.${attrGroup}.${attr}`);
                  updatesDiff[actorType][`data.${attrGroup}.${attr}`] = newGroup[attr];
                }
              }
            }
          }
        }

      }
    }

    let hasAdditions = configDiff.add.length > 0;
    let hasDeletions = configDiff.del.length > 0;
    let hasMax = configDiff.max.length > 0;
    let hasSoftType = configDiff.softType.length > 0;
    let hasHardType = configDiff.hardType.length > 0;
    let hasSafe = configDiff.safe.length > 0;

    const t = {
      'confirmChanges': game.i18n.localize('PBTA.Settings.sheetConfig.confirmChanges'),
      'confirm': game.i18n.localize('PBTA.Settings.sheetConfig.confirm'),
      'confirmUpdate': game.i18n.localize('PBTA.Settings.sheetConfig.confirmUpdate'),
      'cancel': game.i18n.localize('PBTA.Settings.sheetConfig.cancel'),
      'additions': game.i18n.localize('PBTA.Settings.sheetConfig.additions'),
      'deletions': game.i18n.localize('PBTA.Settings.sheetConfig.deletions'),
      'maxValue': game.i18n.localize('PBTA.Settings.sheetConfig.maxValue'),
      'type': game.i18n.localize('PBTA.Settings.sheetConfig.type'),
      'typeReset': game.i18n.localize('PBTA.Settings.sheetConfig.typeReset'),
      'cosmetic': game.i18n.localize('PBTA.Settings.sheetConfig.cosmetic'),
      'noteChangesDetected': game.i18n.localize('PBTA.Settings.sheetConfig.noteChangesDetected'),
      'noteConfirm': game.i18n.localize('PBTA.Settings.sheetConfig.noteConfirm'),
      'noteConfirmUpdate': game.i18n.localize('PBTA.Settings.sheetConfig.noteConfirmUpdate'),
      'noteConfirmUpdateBold': game.i18n.localize('PBTA.Settings.sheetConfig.noteConfirmUpdateBold'),
      'noteCancel': game.i18n.localize('PBTA.Settings.sheetConfig.noteCancel'),
    };

    if (hasAdditions || hasDeletions || hasMax || hasSoftType || hasHardType || hasSafe) {
      let content = `<p>${t.noteChangesDetected}</p><ul><li>${t.noteConfirm}</li><li>${t.noteConfirmUpdate}<strong> (${t.noteConfirmUpdateBold})</strong></li><li>${t.noteCancel}</li></ul>`;

      if (hasAdditions) {
        content = content + `<h2>${t.additions}</h2><ul class="pbta-changes"><li><strong> + </strong>${configDiff.add.join('</li><li><strong> + </strong>')}</li></ul>`;
      }

      if (hasDeletions) {
        content = content + `<h2>${t.deletions}</h2><ul class="pbta-changes"><li><strong> - </strong>${configDiff.del.join('</li><li><strong> - </strong>')}</li></ul>`;
      }

      if (hasMax) {
        content = content + `<h2>${t.maxValue}</h2><ul class="pbta-changes"><li><strong> * </strong>${configDiff.max.join('</li><li><strong> * </strong>')}</li></ul>`;
      }

      if (hasSoftType) {
        content = content + `<h2>${t.type}</h2><ul class="pbta-changes"><li><strong> * </strong>${configDiff.softType.join('</li><li><strong> * </strong>')}</li></ul>`;
      }

      if (hasHardType) {
        content = content + `<h2>${t.typeReset}</h2><ul class="pbta-changes"><li><strong> * </strong>${configDiff.hardType.join('</li><li><strong> * </strong>')}</li></ul>`;
      }

      if (hasSafe) {
        content = content + `<h2>${t.cosmetic}</h2><ul class="pbta-changes"><li><strong> * </strong>${configDiff.safe.join('</li><li><strong> * </strong>')}</li></ul>`;
      }

      return this._confirm({
        title: game.i18n.localize('PBTA.Settings.sheetConfig.confirmChanges'),
        content: content,
        options: {width: 500, classes: ["pbta", "pbta-sheet-confirm"]},
        buttons: {
          yes: {
            icon: '<i class="fas fa-check"></i>',
            label: game.i18n.localize('PBTA.Settings.sheetConfig.confirm'),
            callback: async () => { return true; },
          },
          update: {
            icon: '<i class="fas fa-user-check"></i>',
            label: game.i18n.localize('PBTA.Settings.sheetConfig.confirmUpdate'),
            callback: async () => {
              let result = await PbtaActorTemplates.updateActors(updatesDiff);
              return result;
            },
          },
          no: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize('Cancel'),
            callback: async () => { return false; },
          },
        },
        defaultButton: 'no'
      });

      // return Dialog.confirm({
      //   title: 'Confirm Changes',
      //   content: content,
      //   yes: () => { return true; },
      //   no: () => { return false; },
      //   defaultYes: false
      // });
    }
    else {
      return true;
    }
  }

  async _confirm({title, content, buttons, defaultButton, options = {}, rejectClose = false, render}={}) {
    return new Promise((resolve, reject) => {
      let resolveButtons = {};

      for (let [k, v] of Object.entries(buttons)) {
        resolveButtons[k] = {
          icon: v.icon ?? null,
          label: v.label ?? null,
          callback: html => {
            const result = v.callback ? v.callback(html) : true;
            resolve(result);
          }
        };
      }

      const dialog = new Dialog({
        title: title,
        content: content,
        buttons: resolveButtons,
        default: defaultButton ?? Object.keys(resolveButtons)[0],
        render: render,
        close: () => {
          if ( rejectClose ) reject("The confirmation Dialog was closed without a choice being made");
          else resolve(null);
        },
      }, options);
      dialog.render(true);
    });
  }
}