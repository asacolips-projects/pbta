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
    let data = game.settings.get("pbta", "sheetConfig") ?? {};
    // @todo hack to fix the old the default value. Remove in a future update.
    if (typeof data != 'object') data = {};
    data.sheetConfigOverride = game.settings.get("pbta", "sheetConfigOverride") ?? {};
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
    if (!game.settings.get('pbta', 'sheetConfigOverride')) {
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
    if (typeof this._submitting !== 'undefined') {
      window.location.reload();
    }
  }

  /* -------------------------------------------- */

  /** @override */
  async _onSubmit(event, options) {
    super._onSubmit(event, options);
    // TODO: Uncomment before committing.
    // window.location.reload();
  }

  /* -------------------------------------------- */

  /** @override */
  async _updateObject(event, formData) {
    let computed = {};

    computed = PbtaUtility.parseTomlString(formData.tomlString) ?? null;
    if (computed) {
      let confirm = true;
      if (game.pbta.sheetConfig?.actorTypes?.character && game.pbta.sheetConfig?.actorTypes?.npc) {
        confirm = await this.diffSheetConfig(computed);
      }
      if (!confirm) {
        throw new Error('Cancelled');
      }
      if (computed) {
        formData.computed = computed;
      }
      await game.settings.set("pbta", "sheetConfig", formData);
    }
  }

  async diffSheetConfig(sheetConfig) {
    if (!game.pbta.sheetConfig) return;

    let currentConfig = game.pbta.sheetConfig;
    let duplicateConfig = duplicate(sheetConfig);
    let newConfig = PbtaUtility.convertSheetConfig(duplicateConfig);

    let configDiff = {
      'add': [],
      'del': [],
      'max': [],
      'softType': [],
      'hardType': [],
      'safe': [],
      'options': []
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
      // Handle deleting custom actor types.
      if (typeof newConfig?.actorTypes[actorType] === 'undefined' || !newConfig.actorTypes[actorType]) {
        configDiff.del.push(`${actorType}`);
        continue;
      }
      // Handle baseType on custom actor types.
      if (newConfig.actorTypes[actorType].baseType) {
        if (newConfig.actorTypes[actorType].baseType != currentConfig.actorTypes[actorType].baseType) {
          // This is only stored in the sheetConfig and not on actor's directly,
          // so we just need to notify the user that a change will be made.
          configDiff.hardType.push(`${actorType}.baseType`);
        }
      }
      // Handle attribute groups.
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
            updatesDiff[actorType][`system.${attrGroup}.${attr}`] = newGroup[attr];
          }
          else {
            // Handle updating label values.
            if (newGroup[attr].label && newGroup[attr].label != oldGroup[attr].label) {
              configDiff.safe.push(`${actorType}.${attrGroup}.${attr}.label`);
              updatesDiff[actorType][`system.${attrGroup}.${attr}.label`] = newGroup[attr].label;
            }
            if (newGroup[attr].customLabel && newGroup[attr].customLabel != oldGroup[attr].customLabel) {
              configDiff.safe.push(`${actorType}.${attrGroup}.${attr}.customLabel`);
              updatesDiff[actorType][`system.${attrGroup}.${attr}.customLabel`] = newGroup[attr].customLabel;
            }
            // Handle updating description values.
            if (newGroup[attr].description && newGroup[attr].description != oldGroup[attr].description) {
              configDiff.safe.push(`${actorType}.${attrGroup}.${attr}.description`);
              updatesDiff[actorType][`system.${attrGroup}.${attr}.description`] = newGroup[attr].description;
            }
          }
        }
        for (let attr of Object.keys(oldGroup)) {
          if (attr == 'ask' || attr == 'prompt' || attr == 'formula') {
            continue;
          }

          if (!newGroup[attr]) {
            configDiff.del.push(`${actorType}.${attrGroup}.${attr}`);
            updatesDiff[actorType][`system.${attrGroup}.-=${attr}`] = null;
          }
          else {
            // Handle updating max values.
            if (newGroup[attr].max && oldGroup[attr].max) {
              if (newGroup[attr].max != oldGroup[attr].max) {
                configDiff.max.push(`${actorType}.${attrGroup}.${attr}`);
                updatesDiff[actorType][`system.${attrGroup}.${attr}.max`] = newGroup[attr].max;
                updatesDiff[actorType][`system.${attrGroup}.${attr}.value`] = newGroup[attr].default ?? 0;

                // Handle types that have steps.
                if (newGroup[attr].steps) {
                  updatesDiff[actorType][`system.${attrGroup}.${attr}.steps`] = newGroup[attr].steps;
                }
                else {
                  updatesDiff[actorType][`system.${attrGroup}.${attr}.-=steps`] = null;
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
                  updatesDiff[actorType][`system.${attrGroup}.${attr}.type`] = newGroup[attr].type;
                }
                else {
                  configDiff.hardType.push(`${actorType}.${attrGroup}.${attr}`);
                  updatesDiff[actorType][`system.${attrGroup}.${attr}`] = newGroup[attr];
                }
              }
              else if (newType == 'ListMany') {
                // Handle diffing condition changes.
                if ((newGroup[attr]?.condition || oldGroup[attr]?.condition)
                && (newGroup[attr]?.condition != oldGroup[attr]?.condition)) {
                  configDiff.softType.push(`${actorType}.${attrGroup}.${attr}`);
                  updatesDiff[actorType][`system.${attrGroup}.${attr}.condition`] = newGroup[attr]?.condition ?? false;
                }

                // Handle diffing options.
                if (newGroup[attr]?.options || oldGroup[attr]?.options) {
                  if (this.optionsAreDifferent(newGroup[attr]?.options, oldGroup[attr]?.options)) {
                    // Remove values from options so that they're not unset on existing actors.
                    if (newGroup[attr]?.options) {
                      for (let [optK, optV] of Object.entries(newGroup[attr].options)) {
                        if (typeof optV.value !== 'undefined') delete optV.value;
                      }
                    }
                    // Create the options diff.
                    configDiff.options.push(`${actorType}.${attrGroup}.${attr}`);
                    updatesDiff[actorType][`system.${attrGroup}.${attr}.options`] = newGroup[attr]?.options ?? [];
                  }
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
    let hasOptions = configDiff.options.length > 0;

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
      'options': game.i18n.localize('PBTA.Settings.sheetConfig.options'),
      'noteChangesDetected': game.i18n.localize('PBTA.Settings.sheetConfig.noteChangesDetected'),
      'noteConfirm': game.i18n.localize('PBTA.Settings.sheetConfig.noteConfirm'),
      'noteConfirmUpdate': game.i18n.localize('PBTA.Settings.sheetConfig.noteConfirmUpdate'),
      'noteConfirmUpdateBold': game.i18n.localize('PBTA.Settings.sheetConfig.noteConfirmUpdateBold'),
      'noteCancel': game.i18n.localize('PBTA.Settings.sheetConfig.noteCancel'),
    };

    if (hasAdditions || hasDeletions || hasMax || hasSoftType || hasHardType || hasSafe || hasOptions) {
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

      if (hasOptions) {
        content = content + `<h2>${t.options}</h2><ul class="pbta-changes"><li><strong> * </strong>${configDiff.options.join('</li><li><strong> * </strong>')}</li></ul>`;
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

  optionsAreDifferent(options1, options2) {
    if (!options1 || !options2) return true;

    let arr1 = Object.values(options1).map(a => a.label);
    let arr2 = Object.values(options2).map(a => a.label);

    let options1String = arr1.sort().join('');
    let options2String = arr2.sort().join('');

    return options1String != options2String;
  }
}