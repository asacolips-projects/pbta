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
    // event.target.querySelectorAll("input[disabled]").forEach(i => i.disabled = false);
    return super._onSubmit(event, options);
  }

  /* -------------------------------------------- */

  /** @override */
  async _updateObject(event, formData) {
    if (formData.tomlString) {
      let computed = toml.parse(formData.tomlString);
      if (computed) {
        formData.computed = computed;
      }
    }
    console.log(formData);
    await game.settings.set("pbta", "sheetConfig", formData);
  }
}