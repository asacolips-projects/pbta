import { PBTA } from "../config.js";
import { PbtaUtility } from "../utility.js";
import { codeMirrorAddToml } from './codemirror.toml.js';

export class PbtaSettingsConfigDialog extends FormApplication {
  /** @override */
	static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      title: game.i18n.localize("PBTA.Settings.sheetConfig.title"),
      id: "pbta-sheet-config",
      template: "systems/pbta/templates/dialog/sheet-config.html",
      width: 660,
      height: 500,
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
    ui.notifications.info(`Reset sheet config.`);
    return this.render();
  }

  async close(options) {
    super.close(options);
    window.location.reload();
  }

  /* -------------------------------------------- */

  /** @override */
  async _onSubmit(event, options) {
    console.log("TEST");
    // event.target.querySelectorAll("input[disabled]").forEach(i => i.disabled = false);
    return super._onSubmit(event, options);
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
      errors = ["No sheet config has been entered."];
    }

    console.log(computed);

    if (errors.length > 0) {
      for (let error of errors) {
        ui.notifications.error(error, {permanent: true});
      }
      throw new Error(errors.join('\r\n'));
    }
    else {
      let confirm = await this.diffSheetConfig(computed);
      console.log(confirm);
      if (!confirm) {
        throw new Error('Cancelled');
      }
      if (computed) {
        formData.computed = computed;
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

    // Handle rollFormula.
    if (!sheetConfig.rollFormula) {
      errors.push("'rollFormula' is required.");
    }

    //  Handle rollResults.
    if (!sheetConfig.rollResults) {
      errors.push("'rollResults' is required.");
    }
    if (typeof sheetConfig.rollResults != 'object' || Object.keys(sheetConfig.rollResults).length < 1) {
      errors.push("'rollResults' were entered incorrectly.");
    }

    // Handle actor config.
    let actorTypes = ['character', 'npc'];

    // Iterate through the actor types.
    for (let actorType of actorTypes) {
      // Error for missing actor type.
      if (!sheetConfig[actorType]) {
        errors.push(`'${actorType}' actor type is required.`);
        continue;
      }

      // Store this in an easier to reference variable.
      let actorConfig = sheetConfig[actorType];

      // Validate stats.
      if (actorConfig.stats) {
        if (actorConfig.stats.length > 0) {
          for (let [k,v] of actorConfig.stats) {
            if (typeof v != 'string') {
              errors.push(`stat "${k}" must be a string, such as "Cool"`);
            }
          }
        }
      }
      // Stats are required for characters (but not for NPCs).
      else {
        if (actorType == 'character') {
          errors.push(`'stats' are required for '${actorType}' group.`);
        }
      }

      // Validate attribute groups.
      let attrGroups = ['attributesTop', 'attributesLeft'];
      for (let attrGroup of attrGroups) {
        // If an attribute group is present, validate it.
        if (actorConfig[attrGroup]) {
          // Groups must be objects.
          if (typeof actorConfig[attrGroup] != 'object') {
            errors.push(`'${actorType}.${attrGroup}' must be a group of attributes.`);
          }
          else {
            // Iterate through each attribute.
            for (let [attr, attrValue] of Object.entries(actorConfig[attrGroup])) {
              // Confirm the attribute type is valid.
              let attrType = typeof attrValue == 'object' && attrValue.type ? attrValue.type : attrValue;
              if (!PBTA.attrTypes.includes(attrType)) {
                errors.push(`Attribute '${actorType}.${attrGroup}.${attr}' must be one of the following types: ${PBTA.attrTypes.join(', ')}.`);
              }

              // If this is a clock or XP, require a max value. Resources also
              // have a max prop, but those can be freely edited by the user and
              // are therefore not required.
              if (attrType == 'Clock' || attrType == 'Xp') {
                if (!attrValue.max) {
                  errors.push(`Attribute '${actorType}.${attrGroup}.${attr}' must include a 'max' property.`);
                }
              }

              // Handle list types.
              if (attrType == 'ListMany') {
                if (!attrValue.options) {
                  errors.push(`Attribute '${actorType}.${attrGroup}.${attr}' must include an 'options' group.`);
                }
                else if (typeof attrValue.options != 'object' || Object.keys(attrValue.options).length < 1) {
                  errors.push(`Attribute '${actorType}.${attrGroup}.${attr}' must include at least one option in the 'options' group.`);
                }
              }
            }
          }
        }
      }

      // Validate that the movetypes are included as an array.
      if (!actorConfig.moveTypes || typeof actorConfig.moveTypes != 'object' || Object.keys(actorConfig.moveTypes).length < 1) {
        errors.push(`'${actorType}.moveTypes' is required and must have at least one move type.`);
      }
    }

    // Return the array of errors for output.
    return errors;
  }

  async diffSheetConfig(sheetConfig) {
    let currentConfig = game.pbta.sheetConfig;
    let duplicateConfig = duplicate(sheetConfig);
    let newConfig = PbtaUtility.convertSheetConfig(duplicateConfig);
    console.log({
      c: currentConfig,
      n: newConfig
    });

    let configDiff = {
      'add': [],
      'del': []
    };
    let actorTypes = ['character', 'npc'];
    let attrGroups = ['attrLeft', 'attrTop'];

    for (let actorType of actorTypes) {
      for (let attrGroup of attrGroups) {
        if (!currentConfig.actorTypes[actorType][attrGroup]) {
          configDiff.add.push(`${actorType}.${attrGroup}`);
          continue;
        }

        if (!newConfig.actorTypes[actorType][attrGroup]) {
          configDiff.add.push(`${actorType}.${attrGroup}`);
          continue;
        }

        for (let attr of Object.keys(newConfig.actorTypes[actorType][attrGroup])) {
          if (!currentConfig.actorTypes[actorType][attrGroup][attr]) {
            configDiff.add.push(`${actorType}.${attrGroup}.${attr}`);
          }
        }
        for (let attr of Object.keys(currentConfig.actorTypes[actorType][attrGroup])) {
          if (!newConfig.actorTypes[actorType][attrGroup][attr]) {
            configDiff.del.push(`${actorType}.${attrGroup}.${attr}`);
          }
        }

      }
    }

    let hasAdditions = configDiff.add.length > 0;
    let hasDeletions = configDiff.del.length > 0;

    if (hasAdditions || hasDeletions) {
      let content = '';

      if (hasAdditions) {
        content = content + `<h2>Additions:</h2><ul><li>${configDiff.add.join('</li><li>')}</li></ul>`;
      }

      if (hasDeletions) {
        content = content + `<h2>Deletions:</h2><ul><li>${configDiff.del.join('</li><li>')}</li></ul>`;
      }

      return Dialog.confirm({
        title: 'Confirm Changes',
        content: content,
        yes: () => { return true; },
        no: () => { return false; },
        defaultYes: false
      });
    }
    else {
      return true;
    }
  }
}