import { PbtaPlaybooks } from "../config.js";

/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export class PbtaItemSheet extends ItemSheet {

  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["pbta", "sheet", "item"],
      width: 520,
      height: 480,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "details" }],
      submitOnChange: true,
      baseApplication: "ItemSheet"
    });
  }

  /* -------------------------------------------- */

  /** @override */
  get template() {
    const path = "systems/pbta/templates/items";
    return `${path}/${this.item.type}-sheet.html`;
  }

  /* -------------------------------------------- */

  /** @override */
  async getData() {
    let isOwner = false;
    let isEditable = this.isEditable;
    let context = this.object.toObject(false);
    let items = {};
    let effects = {};
    let actor = null;

    this.options.title = this.document.name;
    isOwner = this.document.isOwner;
    isEditable = this.isEditable;
    // context = foundry.utils.deepClone(this.object.data);

    // Copy Active Effects
    effects = this.object.effects.map(e => foundry.utils.deepClone(e));
    context.effects = effects;

    // Grab the parent actor, if any.
    actor = this.object?.parent;

    context.dtypes = ["String", "Number", "Boolean"];
    // Add playbooks.
    context.system.playbooks = await PbtaPlaybooks.getPlaybooks();

    // Add move types.
    let actorType = null;
    let itemType = this?.object?.type ?? 'move';

    if (itemType == 'move') actorType = 'character';
    else if (itemType == 'npcMove') actorType = 'npc';
    else actorType = 'character';

    // Handle actor types.
    let pbtaActorType = actorType;
    let pbtaSheetType = actorType;
    let pbtaBaseType = actorType;

    // Override with the parent actor if possible.
    if (actor) {
      pbtaActorType = actor.type;
      if (pbtaActorType == 'other') {
        pbtaSheetType = actor.system?.customType ?? 'character';
        pbtaBaseType = game.pbta.sheetConfig.actorTypes[pbtaSheetType]?.baseType ?? 'character';
      }
      else {
        pbtaSheetType = pbtaActorType;
        pbtaBaseType = pbtaActorType;
      }
    }

    if (itemType == 'move') {
      context.system.stats = game.pbta.sheetConfig?.actorTypes[pbtaSheetType]?.stats ? duplicate(game.pbta.sheetConfig.actorTypes[pbtaSheetType].stats) : {};
      context.system.stats['prompt'] = {label: game.i18n.localize('PBTA.Prompt')};
      context.system.stats['ask'] = {label: game.i18n.localize('PBTA.Ask')};
      context.system.stats['formula'] = {label: game.i18n.localize('PBTA.Formula')};
    }

    context.system.moveTypes = game.pbta.sheetConfig?.actorTypes[pbtaSheetType]?.moveTypes ?? {};
    context.system.equipmentTypes = game.pbta.sheetConfig?.actorTypes[pbtaSheetType]?.equipmentTypes ?? null;

    // Add roll example.
    if (itemType == 'npcMove') {
      context.system.rollExample = game.pbta.sheetConfig?.rollFormula ?? '2d6';
    }

    // Handle rich text fields.
    const enrichmentOptions = {
      secrets: false,
      documents: true,
      links: true,
      rolls: true,
      rollData: actor?.getRollData() ?? {},
      async: true,
      relativeTo: actor ?? null
    };

    if (context.system?.description) {
      context.system.description = await TextEditor.enrichHTML(context.system.description, enrichmentOptions);
    }

    if (itemType == 'move' || itemType == 'npcMove') {
      for (let [key, moveResult] of Object.entries(context.system.moveResults)) {
        context.system.moveResults[key].rangeName = `system.moveResults.${key}.value`;
        context.system.moveResults[key].value = await TextEditor.enrichHTML(moveResult.value, enrichmentOptions);
      }
    }

    if (context.system?.choices) {
      context.system.choices = await TextEditor.enrichHTML(context.system.choices, enrichmentOptions);
    }

    // Handle preprocessing for tagify data.
    if (itemType == 'equipment') {
      // If there are tags, convert it into a string.
      if (context.system.tags != undefined && context.system.tags != '') {
        let tagArray = [];
        try {
          tagArray = JSON.parse(context.system.tags);
        } catch (e) {
          tagArray = [context.system.tags];
        }
        context.system.tagsString = tagArray.map((item) => {
          return item.value;
        }).join(', ');
      }
      // Otherwise, set tags equal to the string.
      else {
        context.system.tags = context.system.tagsString;
      }
    }

    let returnData = {};
    returnData = {
      item: this.object,
      cssClass: isEditable ? "editable" : "locked",
      editable: isEditable,
      system: context.system,
      effects: effects,
      limited: this.object.limited,
      options: this.options,
      owner: isOwner,
      title: context.name
    };

    return returnData;
  }

  /* -------------------------------------------- */

  /** @override */
  async activateListeners(html) {
    super.activateListeners(html);

    // Activate tabs
    let tabs = html.find('.tabs');
    let initial = this._sheetTab;
    new TabsV2(tabs, {
      initial: initial,
      callback: clicked => this._sheetTab = clicked.data("tab")
    });

    this._tagify(html, this.options.editable);

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    this.html = html;

    // Add or Remove Attribute
    html.find(".class-fields").on("click", ".class-control", this._onClickClassControl.bind(this));

    // TODO: Create tags that don't already exist on focus out. This is a
    // nice-to-have, but it's high risk due to how easy it will make it to
    // create extra tags unintentionally.
  }

  /**
   * Add tagging widget.
   */
  async _tagify(html, editable) {
    // Build the tags list.
    let tags = game.items.filter(item => item.type == 'tag').map(item => {
      return item.name;
    });
    for (let c of game.packs) {
      if (c.metadata.type && c.metadata.type == 'Item' && c.metadata.name == 'tags') {
        let items = c?.index ? c.index.map(indexedItem => {
          return indexedItem.name;
        }) : [];
        tags = tags.concat(items);
      }
    }
    // Reduce duplicates.
    let tagNames = [];
    for (let tag of tags) {
      if (typeof tag == 'string') {
        let tagName = tag.toLowerCase();
        if (tagNames.includes(tagName) === false) {
          tagNames.push(tagName);
        }
      }
    }

    // Sort the tagnames list.
    tagNames.sort((a, b) => {
      const aSort = a.toLowerCase();
      const bSort = b.toLowerCase();
      if (aSort < bSort) {
        return -1;
      }
      if (aSort > bSort) {
        return 1;
      }
      return 0;
    });

    // Tagify!
    var $input = html.find('input[name="system.tags"]');
    if ($input.length > 0) {
      if (!editable) {
        $input.attr('readonly', true);
      }

      // init Tagify script on the above inputs
      var tagify = new Tagify($input[0], {
        whitelist: tagNames,
        maxTags: 'Infinity',
        dropdown: {
          maxItems: 20,           // <- mixumum allowed rendered suggestions
          classname: "tags-look", // <- custom classname for this dropdown, so it could be targeted
          enabled: 0,             // <- show suggestions on focus
          closeOnSelect: false    // <- do not hide the suggestions dropdown once an item has been selected
        }
      });
    }
  }

  /* -------------------------------------------- */

  /**
   * Listen for click events on an attribute control to modify the composition of attributes in the sheet
   * @param {MouseEvent} event    The originating left click event
   * @private
   */
  async _onClickClassControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const action = a.dataset.action;
    const field_type = a.dataset.type;
    const form = this.form;

    let field_types = {
      'races': 'race',
      'alignments': 'alignment'
    };

    // // Add new attribute
    if (action === "create") {
      if (Object.keys(field_types).includes(field_type)) {
        const field_values = this.object.system[field_type];
        const nk = Object.keys(field_values).length + 1;
        let newKey = document.createElement("div");
        newKey.innerHTML = `<li class="item ${field_types[field_type]}" data-index="${nk}">
    <div class="flexrow">
      <input type="text" class="input input--title" name="system.${field_type}.${nk}.label" value="" data-dtype="string"/>
      <a class="class-control" data-action="delete" data-type="${field_type}"><i class="fas fa-trash"></i></a>
    </div>
    <textarea class="${field_types[field_type]}" name="system.${field_type}.${nk}.description" rows="5" title="What's your ${field_types[field_type]}?" data-dtype="String"></textarea>
  </li>`;
        newKey = newKey.children[0];
        form.appendChild(newKey);
        await this._onSubmit(event);
      }
      else if (field_type == 'equipment-groups') {
        const field_values = this.object.system.equipment;
        const nk = Object.keys(field_values).length + 1;
        let template = '/systems/pbta/templates/items/_class-sheet--equipment-group.html';
        let templateData = {
          group: nk
        };
        let newKey = document.createElement('div');
        newKey.innerHTML = await renderTemplate(template, templateData);
        newKey = newKey.children[0];

        let update = duplicate(this.object);
        update.system.equipment[nk] = {
          label: '',
          mode: 'radio',
          items: [],
          objects: []
        };

        await this.object.update(update);

        form.appendChild(newKey);
        await this._onSubmit(event);
      }
    }

    // Remove existing attribute
    else if (action === "delete") {
      const field_type = a.dataset.type;
      if (field_type == 'equipment-groups') {
        let elem = a.closest('.equipment-group');
        const nk = elem.dataset.index;
        elem.parentElement.removeChild(elem);
        let update = {};
        update[`system.equipment.-=${nk}`] = null;
        await this.object.update(update);
        await this._onSubmit(event);
      }
      else {
        const li = a.closest(".item");
        const nk = li.dataset.index;
        li.parentElement.removeChild(li);
        let update = {};
        update[`system.${field_type}.-=${nk}`] = null;
        await this.object.update(update);
        await this._onSubmit(event);
      }
    }
  }

  /* -------------------------------------------- */

  /** @override */
  _updateObject(event, formData) {
    // Update the Item
    return this.object.update(formData);
  }
}
