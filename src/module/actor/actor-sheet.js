import { PbtaPlaybooks } from "../config.js";
import { PbtaUtility } from "../utility.js";
import { PbtaRolls } from "../rolls.js";
import { PbtaActorTemplates } from "../pbta/pbta-actors.js";

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class PbtaActorSheet extends ActorSheet {

  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["pbta", "sheet", "actor"],
      width: 840,
      height: 780,
      scrollY: [".window-content"],
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "moves" }]
    });
  }

  static unsupportedItemTypes = new Set(["npcMove", "tag"]);

  /* -------------------------------------------- */

  /** @override */
  get template() {
    const path = "systems/pbta/templates/sheet";
    return `${path}/${this.actor.type}-sheet.html`;
  }

  /* -------------------------------------------- */

  /** @override */
  async getData() {
    let isOwner = false;
    let isEditable = this.isEditable;
    let context = {};
    let items = {};
    let effects = {};
    let actorData = {};
    let sheetConfig = foundry.utils.deepClone(game.pbta.sheetConfig);

    // const data = super.getData();
    isOwner = this.document.isOwner;
    isEditable = this.isEditable;
    // The Actor's data
    actorData = this.actor.toObject(false);
    context.actor = actorData;
    context.system = actorData.system;

    // Owned Items
    context.items = actorData.items;
    for ( let i of context.items ) {
      const item = this.actor.items.get(i._id);
      i.labels = item.labels;
    }
    context.items.sort((a, b) => (a.sort || 0) - (b.sort || 0));

    // Copy Active Effects
    // TODO: Test and refactor this.
    effects = this.object.effects.map(e => foundry.utils.deepClone(e));
    context.effects = effects;

    // Handle actor types.
    context.pbtaActorType = this.actor.type;
    if (context.pbtaActorType == 'other') {
      context.pbtaSheetType = actorData.system?.customType ?? 'character';
      context.pbtaBaseType = sheetConfig.actorTypes[context.pbtaSheetType]?.baseType ?? 'character';
    }
    else {
      context.pbtaSheetType = context.pbtaActorType;
      context.pbtaBaseType = context.pbtaActorType;
    }

    // Handle rich text fields.
    const enrichmentOptions = {
      secrets: false,
      documents: true,
      links: true,
      rolls: true,
      rollData: this.actor.getRollData() ?? {},
      async: true,
    };
    context.enrichmentOptions = enrichmentOptions;

    // Prepare items.
    await this._prepareCharacterItems(context);
    await this._prepareNpcItems(context);
    await this._prepareAttrs(context);

    if (context.system?.details?.biography) {
      context.system.details.biography = await TextEditor.enrichHTML(context.system.details.biography, enrichmentOptions);
    }

    // Add playbooks.
    if (context.pbtaSheetType == 'character' || context.pbtaBaseType == 'character') {
      context.system.playbooks = await PbtaPlaybooks.getPlaybooks();
      context.system.statToggle = sheetConfig?.statToggle ?? false;
      context.system.statSettings = sheetConfig.actorTypes[context.pbtaSheetType].stats ?? {};

      if (context.system.statSettings) {
        context.system.statSettings['ask'] = {label: game.i18n.localize('PBTA.Ask'), value: 0};
        context.system.statSettings['prompt'] = {label: game.i18n.localize('PBTA.Prompt'), value: 0};
        context.system.statSettings['formula'] = {label: game.i18n.localize('PBTA.Formula'), value: 0};
      }

      let xpSvg = {
        radius: 16,
        circumference: 100,
        offset: 100,
      };

      // Flags
      context.rollModes = {
        def: 'PBTA.Normal',
        adv: 'PBTA.Advantage',
        dis: 'PBTA.Disadvantage'
      };

      // Set a warning for tokens.
      context.system.isToken = this.actor.token != null;
    }

    this._sortAttrs(context);

    // Get sheet visibility settings.
    const sheetSettings = {};
    const settingKeys = [
      'hideRollFormula',
      'hideForward',
      'hideOngoing',
      'hideRollMode',
      'hideUses'
    ];

    for (let key of settingKeys) {
      sheetSettings[key] = game.settings.get('pbta', key);
    }

    // Get flags.
    const flags = this.object?.flags ?? {};

    if (!flags?.pbta?.rollMode) {
      if (!flags?.pbta) flags.pbta = {};
      flags.pbta.rollMode = 'def';
    }

    let returnData = {
      actor: this.object,
      cssClass: isEditable ? "editable" : "locked",
      editable: isEditable,
      system: context.system,
      moves: context.moves,
      moveTypes: context.moveTypes,
      equipment: context.equipment,
      equipmentTypes: context.equipmentTypes,
      rollModes: context?.rollModes,
      effects: effects,
      flags: flags,
      items: items,
      limited: this.object.limited,
      options: this.options,
      owner: isOwner,
      title: this.title,
      rollData: this.actor.getRollData(),
      sheetSettings: sheetSettings
    };

    // Return template data
    return returnData;
  }

  /**
   * Prepare attributes for templates.
   *
   * The editor helper for TinyMCE editors is unable to handle dynamic props,
   * so this helper adds a string that we'll use later for the name attribute
   * on the HTML element.
   *
   * @param {object} sheetData Data prop on actor.
   */
  async _prepareAttrs(sheetData) {
    const actorData = sheetData;
    let groups = [
      'attrTop',
      'attrLeft'
    ];
    for (let group of groups) {
      for (let [attrKey, attrValue] of Object.entries(actorData.system[group])) {
        if (attrValue.type == 'LongText') {
          actorData.system[group][attrKey].attrName = `system.${group}.${attrKey}.value`;
          actorData.system[group][attrKey].value = await TextEditor.enrichHTML(attrValue.value, actorData.enrichmentOptions);
        }
      }
    }
  }

  /**
   * Resort attributes based on config.
   *
   * Currently, the way that stats and attributes are applied as updates to
   * actors can cause their keys to become improperly ordered. In a future
   * version we'll need to TODO and fix the order at write time, but currently,
   * this solves the immediate problem and reorders them at render time for the
   * sheet.
   *
   * @param {object} sheetData Data prop on actor.
   */
  _sortAttrs(sheetData) {
    const actorData = sheetData;
    let groups = [
      'stats',
      'attrTop',
      'attrLeft'
    ];
    // Iterate through the groups that need to be sorted.
    for (let group of groups) {
      // Confirm the keys exist, and assign them to a sorting array if so.
      let sortKeys = game.pbta.sheetConfig.actorTypes[sheetData.pbtaSheetType][group];
      let sortingArray = [];
      if (sortKeys) {
        sortingArray = Object.keys(sortKeys);
      }
      else {
        continue;
      }
      // Grab the keys of the group on the actor.
      let newData = Object.keys(actorData.system[group])
      // Sort them based on the sorting array.
      .sort((a,b) => {
        return sortingArray.indexOf(a) - sortingArray.indexOf(b);
      })
      // Build a new object from the sorted keys.
      .reduce(
        (obj, key) => {
          obj[key] = actorData.system[group][key];
          return obj;
        }, {}
      );

      // Replace the data object handed over to the sheet.
      actorData.system[group] = newData;
    }
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} context The actor to prepare.
   *
   * @return {undefined}
   */
  async _prepareCharacterItems(context) {
    const actorData = context;
    const actorType = context.pbtaSheetType ?? 'character';
    const moveType = context.pbtaBaseType == 'npc' ? 'npcMove' : 'move';

    let moveTypes = game.pbta.sheetConfig?.actorTypes[actorType]?.moveTypes;
    actorData.moveTypes = {};
    actorData.moves = {};

    let items = context.items;

    if (moveTypes) {
      for (let [k,v] of Object.entries(moveTypes)) {
        actorData.moveTypes[k] = v.label;
        actorData.moves[k] = [];
      }
    }

    let equipmentTypes = game.pbta.sheetConfig?.actorTypes[actorType]?.equipmentTypes;
    actorData.equipmentTypes = {};
    actorData.equipment = {};

    if (equipmentTypes) {
      for (let [k,v] of Object.entries(equipmentTypes)) {
        actorData.equipmentTypes[k] = v.label;
        actorData.equipment[k] = [];
      }
    }

    if (!actorData.equipment['PBTA_OTHER']) actorData.equipment['PBTA_OTHER'] = [];
    if (!actorData.moves['PBTA_OTHER']) actorData.moves['PBTA_OTHER'] = [];

    // Iterate through items, allocating to containers
    // let totalWeight = 0;
    for (let i of items) {
      let item = i;
      i.img = i.img || DEFAULT_TOKEN;
      // Enrich text fields.
      if (i.system?.description) {
        i.system.description = await TextEditor.enrichHTML(i.system.description, actorData.enrichmentOptions);
      }
      if (i.system?.choices) {
        i.system.choices = await TextEditor.enrichHTML(i.system.choices, actorData.enrichmentOptions);
      }
      if (i.system?.moveResults) {
        for (let [mK, mV] of Object.entries(i.system.moveResults)) {
          if (mV.value) {
            i.system.moveResults[mK].value = await TextEditor.enrichHTML(mV.value, actorData.enrichmentOptions);
          }
        }
      }
      // If this is a move, sort into various arrays.
      if (i.type === moveType) {
        if (actorData.moves[i.system.moveType]) {
          actorData.moves[i.system.moveType].push(i);
        }
        else {
          actorData.moves['PBTA_OTHER'].push(i);
        }
      }
      // If this is equipment, we currently lump it together.
      else if (i.type === 'equipment') {
        if (actorData.equipment[i.system.equipmentType]) {
          actorData.equipment[i.system.equipmentType].push(i);
        }
        else {
          actorData.equipment['PBTA_OTHER'].push(i);
        }
      }
    }
  }

  /**
   * Prepare tagging.
   *
   * @param {Object} context The actor to prepare.
   */
  async _prepareNpcItems(context) {
    // Handle preprocessing for tagify data.
    if (context.pbtaSheetType == 'npc') {
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
  }

  /**
   * Prepare clock attribute types.
   *
   * @param {Object} context The actor to prepare.
   *
   * @return {undefined}
   */
  _prepareStatClocks(context) {
    const actorData = context;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Rollables.
    html.find('.rollable').on('click', this._onRollable.bind(this));
    html.find('.showable').on('click', this._onRollable.bind(this));

    // // View playbook.
    html.find('.view-playbook').on('click', this._onViewPlaybook.bind(this));

    // // Toggle look.
    html.find('.toggle--look').on('click', this._toggleLook.bind(this, html));

    // // Owned Item management
    html.find('.item-create').on('click', this._onItemCreate.bind(this));
    html.find('.item-edit').on('click', this._onItemEdit.bind(this));
    html.find('.item-delete').on('click', this._onItemDelete.bind(this));

    // Moves
    html.find('.item-group-label').on('click', this._hideMoveGroup.bind(this));
    html.find('.item-label').on('click', this._showItemDetails.bind(this));

    // Attributes.
    html.find('.attr-clock').on('click', this._onClockClick.bind(this));
    html.find('.attr-xp').on('click', this._onClockClick.bind(this));

    // Stats.
    html.find('.stat-rollable').on('mouseover', this._onStatHoverOn.bind(this));
    html.find('.stat-rollable').on('mouseout', this._onStatHoverOff.bind(this));

    // Spells.
    // html.find('.prepared').click(this._onPrepareSpell.bind(this));

    // Quantity.
    html.find('.item-meta .tag--quantity').on('click', this._onUsagesControl.bind(this, 'system.quantity', 1));
    html.find('.item-meta .tag--quantity').on('contextmenu', this._onUsagesControl.bind(this, 'system.quantity', -1));

    html.find('.item-meta .tag--uses').on('click', this._onUsagesControl.bind(this, 'system.uses', 1));
    html.find('.item-meta .tag--uses').on('contextmenu', this._onUsagesControl.bind(this, 'system.uses', -1));

    // Resources.
    html.find('.resource-control').on('click', this._onResouceControl.bind(this));

    let isOwner = this.actor.isOwner;

    if (isOwner) {
      /* Item Dragging */
      // Core handlers from foundry.js
      let handler;
      handler = ev => this._onDragStart(ev);

      html.find('li.item').each((i, li) => {
        if (li.classList.contains("inventory-header")) return;
        li.setAttribute("draggable", true);
        li.addEventListener("dragstart", handler, false);
      });
    }

    if (this.actor.type == 'npc') {
      this._activateTagging(html);
    }
  }

  _onResouceControl(event) {
    event.preventDefault();
    const control = $(event.currentTarget);
    const action = control.data('action');
    const attr = control.data('attr');
    // If there's an action and target attribute, update it.
    if (action && attr) {
      // Initialize data structure.
      let system = {};
      let changed = false;
      // Retrieve the existin value.
      system[attr] = Number(getProperty(this.actor.system, attr));
      // Decrease the value.
      if (action == 'decrease') {
        system[attr] -= 1;
        changed = true;
      }
      // Increase the value.
      else if (action == 'increase') {
        system[attr] += 1;
        changed = true;
      }
      // If there are changes, apply to the actor.
      if (changed) {
        this.actor.update({ system: system });
      }
    }
  }

  async _onClockClick(event) {
    event.preventDefault();
    const $self = $(event.currentTarget);
    // Get the clicked value.
    let step = Number($self.data('step'));
    let stepValue = $self.attr('checked') !== undefined;

    // Retrieve the attribute.
    let prop = $self.data('name');
    let attr = deepclone(getProperty(this.actor, prop));

    // Step is offset by 1 (0 index). Adjust and fix.
    step++;

    // Handle clicking the same checkbox to unset its value.
    if (stepValue) {
      if (attr.value == step) {
        step--;
      }
    }

    // Update the stored value.
    attr.value = step;

    // Update the steps.
    for (let i = 0; i < attr.max; i++) {
      if ((i) < attr.value) {
        attr.steps[i] = true;
      }
      else {
        attr.steps[i] = false;
      }
    }

    // Prepare updates.
    let update = {};
    update[prop] = attr;

    // Update the actor/token.
    this._updateActorOrToken(update);
  }

  _hideMoveGroup(event) {
    event.preventDefault();
    const toggler = $(event.currentTarget);
    const toggleIcon = toggler.find('i');
    const group = toggler.parents('.cell--group');
    const description = group.find('.items-list');

    toggler.toggleClass('open');
    description.slideToggle();
  }

  _showItemDetails(event) {
    event.preventDefault();
    const toggler = $(event.currentTarget);
    const toggleIcon = toggler.find('i');
    const item = toggler.parents('.item');
    const description = item.find('.item-description');

    toggler.toggleClass('open');
    description.slideToggle();
  }

  _onStatHoverOn(event) {
    const rollable = $(event.currentTarget);
    const parent = rollable.parents('.stat');
    parent.addClass('hover');
  }

  _onStatHoverOff(event) {
    const rollable = $(event.currentTarget);
    const parent = rollable.parents('.stat');
    parent.removeClass('hover');
  }

  /**
   * Adjust a numerical field on click.
   * @param string property
   * @param int delta
   * @param {MouseEvent} event
   */
  async _onUsagesControl(property, delta, event) {
    event.preventDefault();
    const a = event.currentTarget;
    const itemId = $(a).parents('.item').attr('data-item-id');
    const item = this.actor.items.get(itemId);

    if (item) {
      let originalAmount = getProperty(item.toObject(), property) ?? 0;
      let update = {}
      update[property] = Number(originalAmount) + delta;
      await item.update(update);

      this.render();
    }
  }

  /**
   * Listen for click events on rollables.
   * @param {MouseEvent} event
   */
  async _onRollable(event) {
    // Initialize variables.
    event.preventDefault();
    const a = event.currentTarget;
    const data = a.dataset;
    const itemId = $(a).parents('.item').attr('data-item-id');
    let item = null;
    let flavorText = null;
    let templateData = {};
    const descriptionOnly = a.getAttribute("data-show") === 'description';

    // Retrieve the item.
    if (itemId) {
      item = this.actor.items.get(itemId);
    }

    // Handle rolls coming directly from the ability score.
    if ($(a).hasClass('stat-rollable') && data.mod) {
      let stat = $(a).parents('.stat').data('stat') ?? null;
      flavorText = data.label;
      templateData = {
        title: flavorText,
        resultRangeNeeded: true
      };

      PbtaRolls.rollMove({actor: this.actor, data: null, formula: stat, templateData: templateData});
    }
    else if ($(a).hasClass('attr-rollable') && data.roll) {
      templateData = {
        title: data.label,
        rollType: 'flat'
      };

      PbtaRolls.rollMove({actor: this.actor, data: null, formula: data.roll, templateData: templateData});
    }
    else if (itemId != undefined) {
      item.roll({configureDialog: true, descriptionOnly});
    }
  }

  /**
 * Listen for click events on view playbook.
 * @param {MouseEvent} event
 */
  async _onViewPlaybook(event) {
    // Initialize variables.
    event.preventDefault();
    const a = event.currentTarget;
    const selectedPlaybook = a.getAttribute("data-playbook");
    const playbooks = await PbtaPlaybooks.getPlaybooks(false);
    const foundPlaybook = playbooks.find(playbook => playbook.name === selectedPlaybook);
    if (foundPlaybook) {
      foundPlaybook.sheet.render(true);
    }
  }

  /**
   * Listen for toggling the look column.
   * @param {MouseEvent} event
   */
  _toggleLook(html, event) {
    // Add a class to the sidebar.
    html.find('.sheet-look').toggleClass('closed');

    // Add a class to the toggle button.
    let $look = html.find('.toggle--look');
    $look.toggleClass('closed');
  }

  /* -------------------------------------------- */
  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @private
   */
  async _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    const type = header.dataset.type;
    const dataset = duplicate(header.dataset);
    const system = {};
    const actor = this.actor;
    if (dataset.movetype) {
      system.moveType = dataset.movetype;
    }
    if (dataset.equipmenttype) {
      system.equipmentType = dataset.equipmenttype;
    }
    if (dataset.level) {
      system.spellLevel = dataset.level;
    }
    const name = type == 'bond' ? game.i18n.localize("PBTA.BondDefault") : `New ${type.capitalize()}`;
    let itemData = {
      name: name,
      type: type,
      system: system
    };
    await this.actor.createEmbeddedDocuments('Item', [itemData], {});
  }

  /* -------------------------------------------- */

  /**
   * Handle editing an existing Owned Item for the Actor
   * @param {Event} event   The originating click event
   * @private
   */
  _onItemEdit(event) {
    event.preventDefault();
    const li = event.currentTarget.closest(".item");
    const item = this.actor.items.get(li.dataset.itemId);
    item.sheet.render(true);
  }

  /* -------------------------------------------- */

  async _onDropItemCreate(itemData) {
    let items = itemData instanceof Array ? itemData : [itemData];
    const toCreate = [];
    for ( const item of items ) {
      if ( this.constructor.unsupportedItemTypes.has(item.type) ) {
        continue;
      }
      toCreate.push(item);
    }

    // Create the owned items as normal
    return this.actor.createEmbeddedDocuments("Item", toCreate);
  }

  /* -------------------------------------------- */

  /**
   * Handle deleting an existing Owned Item for the Actor
   * @param {Event} event   The originating click event
   * @private
   */
  async _onItemDelete(event) {
    event.preventDefault();
    const li = event.currentTarget.closest(".item");
    let item = this.actor.items.get(li.dataset.itemId);
    item.delete();
  }

  /**
   * Equivalent to this.actor.update(), but handle tokens automatically.
   * @param {object} updateData Updates to apply.
   * @param {object} options Options for the update.
   */
  async _updateActorOrToken(updateData, options = {}) {
    if (this.token && !this.token.actorLink) {
      this.actor.update(updateData, mergeObject(options, { diff: false }));
    }
    else {
      this.actor.update(updateData, options);
    }
  }

  /* -------------------------------------------- */

  async _activateTagging(html) {
    // Build the tags list.
    let tags = game.items.filter(item => item.type == 'tag').map(item => {
      return item.name;
    });;
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
      let tagName = tag.toLowerCase();
      if (tagNames.includes(tagName) === false) {
        tagNames.push(tagName);
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
}
