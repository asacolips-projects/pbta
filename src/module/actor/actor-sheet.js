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

  /* -------------------------------------------- */

  /** @override */
  get template() {
    const path = "systems/pbta/templates/sheet";
    return `${path}/${this.actor.data.type}-sheet.html`;
  }

  /* -------------------------------------------- */

  /** @override */
  async getData() {
    let isOwner = false;
    let isEditable = this.isEditable;
    let data = {};
    let items = {};
    let effects = {};
    let actorData = {};
    let sheetConfig = foundry.utils.deepClone(game.pbta.sheetConfig);

    // const data = super.getData();
    isOwner = this.document.isOwner;
    isEditable = this.isEditable;
    // The Actor's data
    actorData = this.actor.data.toObject(false);
    data.actor = actorData;
    data.data = actorData.data;

    // Owned Items
    data.items = actorData.items;
    for ( let i of data.items ) {
      const item = this.actor.items.get(i._id);
      i.labels = item.labels;
    }
    data.items.sort((a, b) => (a.sort || 0) - (b.sort || 0));

    // Copy Active Effects
    // TODO: Test and refactor this.
    effects = this.object.effects.map(e => foundry.utils.deepClone(e.data));
    data.effects = effects;

    // Handle actor types.
    data.pbtaActorType = this.actor.type;
    if (data.pbtaActorType == 'other') {
      data.pbtaSheetType = actorData.data?.customType ?? 'character';
      data.pbtaBaseType = sheetConfig.actorTypes[data.pbtaSheetType]?.baseType ?? 'character';
    }
    else {
      data.pbtaSheetType = data.pbtaActorType;
      data.pbtaBaseType = data.pbtaActorType;
    }

    // Prepare items.
    this._prepareCharacterItems(data);
    this._prepareNpcItems(data);
    this._prepareAttrs(data);

    // Add playbooks.
    if (data.pbtaSheetType == 'character' || data.pbtaBaseType == 'character') {
      data.data.playbooks = await PbtaPlaybooks.getPlaybooks();
      data.data.statToggle = sheetConfig?.statToggle ?? false;
      data.data.statSettings = sheetConfig.actorTypes[data.pbtaSheetType].stats ?? {};

      if (data.data.statSettings) {
        data.data.statSettings['ask'] = {label: game.i18n.localize('PBTA.Ask'), value: 0};
        data.data.statSettings['prompt'] = {label: game.i18n.localize('PBTA.Prompt'), value: 0};
        data.data.statSettings['formula'] = {label: game.i18n.localize('PBTA.Formula'), value: 0};
      }

      let xpSvg = {
        radius: 16,
        circumference: 100,
        offset: 100,
      };

      // Flags
      data.rollModes = {
        def: 'PBTA.Normal',
        adv: 'PBTA.Advantage',
        dis: 'PBTA.Disadvantage'
      };

      // Set a warning for tokens.
      data.data.isToken = this.actor.token != null;
      // if (!data.data.isToken) {
      //   // Add levelup choice.
      //   let levelup = (Number(data.data.attributes.xp.value) >= Number(data.data.attributes.level.value) + 7) && Number(data.data.attributes.level.value) < 10;

      //   // Handle the first level (special case).
      //   if (Number(data.data.attributes.level.value) === 1) {
      //     let hasStarting = false;
      //     for (let i = 0; i < data.items.length; i++) {
      //       if (data.items[i].type == 'move' && data.items[i].data.moveType == 'starting') {
      //         hasStarting = true;
      //         break;
      //       }
      //     };

      //     if (!hasStarting) {
      //       levelup = true;
      //     }
      //   }

      //   // Set the template variable.
      //   data.data.levelup = levelup && data.data.playbooks.includes(data.data.details.class);

      //   // Calculate xp bar length.
      //   let currentXp = Number(data.data.attributes.xp.value);
      //   let nextLevel = Number(data.data.attributes.level.value) + 7;
      //   xpSvg = PbtaUtility.getProgressCircle({ current: currentXp, max: nextLevel, radius: 16 });
      // }
      // else {
      //   data.data.levelup = false;
      // }

      // data.data.xpSvg = xpSvg;
    }

    this._sortAttrs(data);

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

    let returnData = {
      actor: this.object,
      cssClass: isEditable ? "editable" : "locked",
      editable: isEditable,
      data: data.data,
      moves: data.moves,
      moveTypes: data.moveTypes,
      equipment: data.equipment,
      equipmentTypes: data.equipmentTypes,
      rollModes: data?.rollModes,
      effects: effects,
      flags: this.object?.data?.flags ?? {},
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
  _prepareAttrs(sheetData) {
    const actorData = sheetData;
    let groups = [
      'attrTop',
      'attrLeft'
    ];
    for (let group of groups) {
      for (let [attrKey, attrValue] of Object.entries(actorData.data[group])) {
        if (attrValue.type == 'LongText') {
          actorData.data[group][attrKey].attrName = `data.${group}.${attrKey}.value`;
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
      let newData = Object.keys(actorData.data[group])
      // Sort them based on the sorting array.
      .sort((a,b) => {
        return sortingArray.indexOf(a) - sortingArray.indexOf(b);
      })
      // Build a new object from the sorted keys.
      .reduce(
        (obj, key) => {
          obj[key] = actorData.data[group][key];
          return obj;
        }, {}
      );

      // Replace the data object handed over to the sheet.
      actorData.data[group] = newData;
    }
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} sheetData The actor to prepare.
   *
   * @return {undefined}
   */
  _prepareCharacterItems(sheetData) {
    const actorData = sheetData;
    const actorType = sheetData.pbtaSheetType ?? 'character';
    const moveType = sheetData.pbtaBaseType == 'npc' ? 'npcMove' : 'move';

    let moveTypes = game.pbta.sheetConfig?.actorTypes[actorType]?.moveTypes;
    actorData.moveTypes = {};
    actorData.moves = {};

    let items = sheetData.items;

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
      let item = i.data;
      i.img = i.img || DEFAULT_TOKEN;
      // If this is a move, sort into various arrays.
      if (i.type === moveType) {
        if (actorData.moves[i.data.moveType]) {
          actorData.moves[i.data.moveType].push(i);
        }
        else {
          actorData.moves['PBTA_OTHER'].push(i);
        }
      }
      // If this is equipment, we currently lump it together.
      else if (i.type === 'equipment') {
        if (actorData.equipment[i.data.equipmentType]) {
          actorData.equipment[i.data.equipmentType].push(i);
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
   * @param {Object} data The actor to prepare.
   */
  _prepareNpcItems(data) {
    // Handle preprocessing for tagify data.
    if (data.pbtaSheetType == 'npc') {
      // If there are tags, convert it into a string.
      if (data.data.tags != undefined && data.data.tags != '') {
        let tagArray = [];
        try {
          tagArray = JSON.parse(data.data.tags);
        } catch (e) {
          tagArray = [data.data.tags];
        }
        data.data.tagsString = tagArray.map((item) => {
          return item.value;
        }).join(', ');
      }
      // Otherwise, set tags equal to the string.
      else {
        data.data.tags = data.data.tagsString;
      }
    }
  }

  /**
   * Prepare clock attribute types.
   *
   * @param {Object} sheetData The actor to prepare.
   *
   * @return {undefined}
   */
  _prepareStatClocks(sheetData) {
    const actorData = sheetData;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Rollables.
    html.find('.rollable').on('click', this._onRollable.bind(this));

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
    html.find('.item-meta .tag--quantity').on('click', this._onUsagesControl.bind(this, 'data.quantity', 1));
    html.find('.item-meta .tag--quantity').on('contextmenu', this._onUsagesControl.bind(this, 'data.quantity', -1));

    html.find('.item-meta .tag--uses').on('click', this._onUsagesControl.bind(this, 'data.uses', 1));
    html.find('.item-meta .tag--uses').on('contextmenu', this._onUsagesControl.bind(this, 'data.uses', -1));

    // Resources.
    html.find('.resource-control').click(this._onResouceControl.bind(this));

    // Adjust weight.
    // this._adjustWeight(html);

    // Character builder dialog.
    // html.find('.clickable-level-up').on('click', this._onLevelUp.bind(this));

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

    if (this.actor.data.type == 'npc') {
      this._activateTagging(html);
    }
  }

  /* -------------------------------------------- */

  // _adjustWeight(html) {
  //   // Adjust weight.
  //   let $weight = html.find('[name="data.attributes.weight.value"]');
  //   let $weight_cell = html.find('.cell--weight');
  //   if ($weight.length > 0) {
  //     let weight = {
  //       current: Number($weight.val()),
  //       max: Number(html.find('[name="data.attributes.weight.max"]').val())
  //     };
  //     if (weight.current > weight.max) {
  //       $weight_cell.addClass('encumbered');

  //       if (weight.current > weight.max + 2) {
  //         $weight_cell.addClass('overencumbered');
  //       }
  //       else {
  //         $weight_cell.removeClass('overencumbered');
  //       }
  //     }
  //     else {
  //       $weight.removeClass('encumbered');
  //     }
  //   }
  // }

  _onResouceControl(event) {
    event.preventDefault();
    const control = $(event.currentTarget);
    const action = control.data('action');
    const attr = control.data('attr');
    // If there's an action and target attribute, update it.
    if (action && attr) {
      // Initialize data structure.
      let data = {};
      let changed = false;
      // Retrieve the existin value.
      data[attr] = Number(getProperty(this.actor.data.data, attr));
      // Decrease the value.
      if (action == 'decrease') {
        data[attr] -= 1;
        changed = true;
      }
      // Increase the value.
      else if (action == 'increase') {
        data[attr] += 1;
        changed = true;
      }
      // If there are changes, apply to the actor.
      if (changed) {
        this.actor.update({ data: data });
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
    let attr = getProperty(this.actor.data, prop);

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

  // async _onLevelUp(event) {
  //   event.preventDefault();

  //   if ($(event.currentTarget).hasClass('disabled-level-up')) {
  //     return;
  //   }

  //   const actor = this.actor.data;
  //   const actorData = this.actor.data.data;

  //   let char_class_name = actorData.details.class;
  //   let orig_class_name = char_class_name;
  //   let class_list = await PbtaPlaybooks.getPlaybooks();
  //   let class_list_items = await PbtaPlaybooks.getPlaybooks(false);

  //   let char_class = PbtaUtility.cleanClass(char_class_name);
  //   let char_level = Number(actorData.attributes.level.value);

  //   // Handle level 1 > 2.
  //   if (actorData.attributes.xp.value != 0) {
  //     char_level = char_level + 1;
  //   }

  //   // Get the original class name if this was a translation.
  //   if (game.babele) {
  //     let babele_classes = game.babele.translations.find(p => p.collection == 'pbta.playbooks');
  //     if (babele_classes) {
  //       let babele_pack = babele_classes.entries.find(p => p.name == char_class_name);
  //       if (babele_pack) {
  //         char_class_name = babele_pack.id;
  //         char_class = PbtaUtility.cleanClass(babele_pack.id);
  //       }
  //     }
  //   }

  //   if (!class_list.includes(orig_class_name) && !class_list.includes(char_class_name)) {
  //     return;
  //   }

  //   let pack_id = `pbta.${char_class}-moves`;
  //   let pack = game.packs.get(pack_id);

  //   let compendium = pack ? await pack.getDocuments() : [];

  //   let class_item = class_list_items.find(i => i.data.name == orig_class_name);
  //   let blurb = class_item ? class_item.data.data.description : null;

  //   // Get races.
  //   let races = [];
  //   if (!this.actor.data.data.details.race.value || !this.actor.data.data.details.race.description) {
  //     races = class_item.data.data.races;
  //     if (typeof races == 'object') {
  //       races = Object.entries(races).map(r => {
  //         return {
  //           key: r[0],
  //           label: r[1]['label'],
  //           description: r[1]['description']
  //         };
  //       });
  //     }
  //   }

  //   // Get alignments.
  //   let alignments = [];
  //   if (!this.actor.data.data.details.alignment.value || !this.actor.data.data.details.alignment.description) {
  //     alignments = class_item.data.data.alignments;
  //     if (typeof alignments == 'object') {
  //       alignments = Object.entries(alignments).map(a => {
  //         return {
  //           key: a[0],
  //           label: a[1]['label'],
  //           description: a[1]['description']
  //         };
  //       });
  //     }
  //   }

  //   // Get equipment.
  //   let equipment = null;
  //   let equipment_list = [];
  //   if (actorData.attributes.xp.value == 0) {
  //     if (typeof class_item.data.data.equipment == 'object') {
  //       let equipmentObjects = await class_item._getEquipmentObjects();
  //       for (let [group, group_items] of Object.entries(equipmentObjects)) {
  //         class_item.data.data.equipment[group]['objects'] = group_items;
  //         equipment_list = equipment_list.concat(group_items);
  //       }
  //       equipment = duplicate(class_item.data.data.equipment);
  //     }
  //   }

  //   // Get ability scores.
  //   let ability_scores = [16, 15, 13, 12, 9, 8];
  //   let ability_labels = Object.entries(CONFIG.PBTA.abilities).map(a => {
  //     return {
  //       short: a[0],
  //       long: a[1],
  //       disabled: Number(this.actor.data.data.abilities[a[0]].value) > 17
  //     }
  //   });

  //   // Retrieve the actor's current moves so that we can hide them.
  //   const actorMoves = this.actor.data.items.filter(i => i.type == 'move');

  //   // Get the item moves as the priority.
  //   let moves = game.items.filter(i => i.type == 'move' && i.data.data.class == char_class_name);
  //   // Get the compendium moves next.
  //   let moves_compendium = compendium.filter(m => {
  //     const available_level = m.data.data.requiresLevel <= char_level;
  //     // TODO: Babele: `const not_taken = actorMoves.filter(i => i.name == m.data.name || i.name === m.data.originalName);`
  //     const not_taken = actorMoves.filter(i => i.name == m.data.name);
  //     return available_level && not_taken.length < 1;
  //   });

  //   // Append compendium moves to the item moves.
  //   let moves_list = moves.map(m => {
  //     return m.data.name;
  //   })
  //   for (let move of moves_compendium) {
  //     if (!moves_list.includes(move.data.name)) {
  //       moves.push(move);
  //     }
  //   }

  //   // Sort the moves and build our groups.
  //   moves.sort((a, b) => {
  //     return a.data.data.requiresLevel - b.data.data.requiresLevel;
  //   });

  //   let starting_moves = [];
  //   let starting_move_groups = [];
  //   if (char_level < 2) {
  //     starting_moves = moves.filter(m => {
  //       return m.data.data.requiresLevel < 2;
  //     });

  //     starting_move_groups = starting_moves.reduce((groups, move) => {
  //       // Assign the undefined group to all Z's so that it's last.
  //       let group = move.data.data.moveGroup ? move.data.data.moveGroup : 'ZZZZZZZ';
  //       if (!groups[group]) {
  //         groups[group] = [];
  //       }

  //       groups[group].push(move);
  //       return groups;
  //     }, {});
  //   }

  //   let advanced_moves_2 = moves.filter(m => {
  //     return m.data.data.requiresLevel >= 2 && m.data.data.requiresLevel < 6;
  //   });

  //   let advanced_moves_6 = moves.filter(m => {
  //     return m.data.data.requiresLevel >= 6;
  //   });

  //   // Determine if spells can be cast.
  //   let cast_spells = [];
  //   let spells = null;
  //   if (char_class == 'the-wizard') {
  //     cast_spells.push('wizard');
  //   }
  //   else if (char_class == 'the-cleric') {
  //     cast_spells.push('cleric');
  //   }
  //   else {
  //     cast_spells.push(char_class);
  //   }

  //   if (cast_spells.length > 0) {
  //     // Retrieve the actor's current moves so that we can hide them.
  //     const actorSpells = this.actor.data.items.filter(i => i.type == 'spell');
  //     let caster_level = char_level;
  //     let spell_preparation_type = null;
  //     spells = [];
  //     for (let caster_class of cast_spells) {
  //       // Get the item spells as the priority.
  //       let spells_items = game.items.filter(i => {
  //         // Return true for custom spell items that have a class.
  //         return i.type == 'spell'
  //           && i.data.data.class
  //           // Check if this spell has either `classname` or `the classname` as its class.
  //           && [caster_class, `the ${caster_class}`].includes(i.data.data.class.toLowerCase());
  //       });
  //       let spells_pack = game.packs.get(`pbta.${char_class}-spells`);
  //       let spells_compendium = spells_pack ? await spells_pack.getDocuments() : [];
  //       // Get the compendium spells next.
  //       let spells_compendium_items = spells_compendium.filter(s => {
  //         const available_level = s.data.data.spellLevel <= caster_level;
  //         const not_taken = actorSpells.filter(i => i.name == s.data.name);
  //         return available_level && not_taken.length < 1;
  //       });

  //       // Append compendium spells to the item spells.
  //       let spells_list = spells.map(s => {
  //         return s.data.name;
  //       })
  //       // Add to the array, and also add to a sorted by level array.
  //       for (let spell of spells_compendium_items) {
  //         if (!spells_list.includes(spell.data.name)) {
  //           spells_items.push(spell);
  //         }
  //       }

  //       // Sort the spells and build our groups.
  //       spells_items.sort((a, b) => {
  //         return a.data.data.spellLevel - b.data.data.spellLevel;
  //       });

  //       let spell_groups = spells_items.reduce((groups, spell) => {
  //         // Default to rotes.
  //         let group = spell.data.data.spellLevel ? spell.data.data.spellLevel : 0;
  //         if (!groups[group]) {
  //           groups[group] = [];
  //         }

  //         groups[group].push(spell);
  //         return groups;
  //       }, {});

  //       // Get the description for how to prepare spells for this class.
  //       if (caster_class == 'wizard') {
  //         let move = moves.filter(m => m.name == 'Spellbook');
  //         if (move && move.length > 0) {
  //           spell_preparation_type = move[0].data.data.description;
  //         }
  //         else {
  //           move = actorMoves.filter(m => m.name == 'Spellbook');
  //           if (move && move.length > 0) {
  //             spell_preparation_type = move[0].data.description;
  //           }
  //         }
  //       }
  //       else if (caster_class == 'cleric') {
  //         let move = moves.filter(m => m.name == 'Commune');
  //         if (move && move.length > 0) {
  //           spell_preparation_type = move[0].data.data.description;
  //         }
  //         else {
  //           move = actorMoves.filter(m => m.name == 'Commune');
  //           if (move && move.length > 0) {
  //             spell_preparation_type = move[0].data.description;
  //           }
  //         }
  //       }

  //       spells.push({
  //         description: spell_preparation_type,
  //         spells: spell_groups
  //       });
  //     }
  //   }

  //   // Build the content.
  //   const template = 'systems/pbta/templates/dialog/level-up.html';
  //   const templateData = {
  //     char_class: char_class,
  //     char_class_name: orig_class_name,
  //     blurb: blurb.length > 0 ? blurb : null,
  //     races: races.length > 0 ? races : null,
  //     alignments: alignments.length > 0 ? alignments : null,
  //     equipment: equipment ? equipment : null,
  //     ability_scores: actorData.attributes.xp.value == 0 ? ability_scores : null,
  //     ability_labels: ability_labels ? ability_labels : null,
  //     starting_moves: starting_moves.length > 0 ? starting_moves : null,
  //     starting_move_groups: starting_move_groups,
  //     advanced_moves_2: advanced_moves_2.length > 0 ? advanced_moves_2 : null,
  //     advanced_moves_6: advanced_moves_6.length > 0 ? advanced_moves_6 : null,
  //     cast_spells: cast_spells.length > 0 ? true : false,
  //     spells: spells ? spells : null,
  //   };
  //   const html = await renderTemplate(template, templateData);

  //   const itemData = {
  //     moves: moves,
  //     races: races,
  //     alignments: alignments,
  //     equipment: equipment_list,
  //     class_item: class_item,
  //     spells: spells,
  //   };

  //   // Initialize dialog options.
  //   const dlg_options = {
  //     width: 920,
  //     height: 640,
  //     classes: ['pbta-level-up', 'pbta', 'sheet'],
  //     resizable: true
  //   };

  //   // Render the dialog.
  //   let d = new Dialog({
  //     title: 'Level Up',
  //     content: html,
  //     id: 'level-up',
  //     buttons: {
  //       cancel: {
  //         icon: '<i class="fas fa-times"></i>',
  //         label: game.i18n.localize("PBTA.Cancel"),
  //         callback: () => null
  //       },
  //       submit: {
  //         icon: '<i class="fas fa-check"></i>',
  //         label: game.i18n.localize("PBTA.Confirm"),
  //         callback: dlg => this._onLevelUpSave(dlg, this.actor, itemData, this)
  //         // callback: dlg => _onImportPower(dlg, this.actor)
  //       }
  //     }
  //   }, dlg_options);
  //   d.render(true);
  // }

  // /**
  //  * Import moves.
  //  */
  // async _onLevelUpSave(dlg, actor, itemData) {
  //   let $selected = $(dlg[0]).find('input:checked,select');

  //   if ($selected.length <= 0) {
  //     return;
  //   }

  //   let move_ids = [];
  //   let equipment_ids = [];
  //   let spell_ids = [];
  //   let abilities = [];
  //   let race = null;
  //   let alignment = null;
  //   for (let input of $selected) {
  //     if (input.dataset.itemId) {
  //       if (input.dataset.type == 'move') {
  //         move_ids.push(input.dataset.itemId);
  //       }
  //       else if (input.dataset.type == 'equipment') {
  //         equipment_ids.push(input.dataset.itemId);
  //       }
  //       else if (input.dataset.type == 'spell') {
  //         spell_ids.push(input.dataset.itemId);
  //       }
  //     }
  //     else if (input.dataset.race) {
  //       race = itemData.races[input.dataset.race];
  //     }
  //     else if (input.dataset.alignment) {
  //       alignment = itemData.alignments[input.dataset.alignment];
  //     }
  //     else if (input.dataset.ability) {
  //       let val = $(input).val();
  //       let abl = input.dataset.ability;
  //       if (val) {
  //         abilities[`abilities.${abl}.value`] = val;
  //       }
  //     }
  //     else if (input.dataset.type == 'ability-increase') {
  //       let abl = $(input).val();
  //       abilities[`abilities.${abl}.value`] = Number(actor.data.data.abilities[abl].value) + 1;
  //     }
  //   }

  //   // Add selected moves.
  //   let new_moves = null;
  //   if (move_ids.length > 0) {
  //     let moves = itemData.moves.filter(m => move_ids.includes(m.id));

  //     // Prepare moves for saving.
  //     new_moves = moves.map(m => {
  //       return duplicate(m);
  //     });
  //   }

  //   // Add selected equipment.
  //   let new_equipment = null;
  //   if (equipment_ids.length > 0) {
  //     let equipment = itemData.equipment.filter(e => equipment_ids.includes(e.id));
  //     new_equipment = equipment.map(e => {
  //       return duplicate(e);
  //     });
  //   }

  //   // Add selected spell.
  //   let new_spells = null;
  //   if (spell_ids.length > 0) {
  //     let spells = [];
  //     if (typeof itemData.spells == 'object') {
  //       // Loop over casting classes.
  //       for (let [key, obj] of Object.entries(itemData.spells)) {
  //         // Loop over spells by level.
  //         for (let [spellLevel, spellsByLevel] of Object.entries(obj.spells)) {
  //           spells = spells.concat(spellsByLevel.filter(s => spell_ids.includes(s.id)));
  //         }
  //       }
  //       // Append to the update array.
  //       new_spells = spells.map(s => {
  //         return duplicate(s);
  //       });
  //     }
  //   }

  //   const data = {};
  //   if (race) {
  //     data['details.race'] = {
  //       value: race.label,
  //       description: race.description
  //     };
  //   }
  //   if (alignment) {
  //     data['details.alignment'] = {
  //       value: alignment.label,
  //       description: alignment.description
  //     }
  //   }
  //   if (abilities != []) {
  //     for (let [key, update] of Object.entries(abilities)) {
  //       data[key] = update;
  //     }
  //   }

  //   // Adjust level.
  //   if (Number(actor.data.data.attributes.xp.value) > 0) {
  //     let xp = Number(actor.data.data.attributes.xp.value) - Number(actor.data.data.attributes.level.value) - 7;
  //     data['attributes.xp.value'] = xp > -1 ? xp : 0;
  //     data['attributes.level.value'] = Number(actor.data.data.attributes.level.value) + 1;
  //   }

  //   // Adjust hp.
  //   if (itemData.class_item.data.data.hp) {
  //     let constitution = actor.data.data.abilities.con.value;
  //     if (data['abilities.con.value']) {
  //       constitution = data['abilities.con.value'];
  //     }
  //     data['attributes.hp.max'] = Number(itemData.class_item.data.data.hp) + Number(constitution);
  //     data['attributes.hp.value'] = data['attributes.hp.max'];
  //   }

  //   // Adjust load.
  //   if (itemData.class_item.data.data.load) {
  //     let strength = actor.data.data.abilities.str.value;
  //     if (data['abilities.str.value']) {
  //       strength = data['abilities.str.value'];
  //     }
  //     data['attributes.weight.max'] = Number(itemData.class_item.data.data.load) + Number(PbtaUtility.getAbilityMod(strength));
  //   }

  //   // Adjust damage die.
  //   if (itemData.class_item.data.data.damage) {
  //     data['attributes.damage.value'] = itemData.class_item.data.data.damage;
  //   }

  //   if (new_moves) {
  //     await actor.createEmbeddedDocument('OwnedItem', new_moves);
  //   }
  //   if (new_equipment) {
  //     await actor.createEmbeddedDocument('OwnedItem', new_equipment);
  //   }
  //   if (new_spells) {
  //     await actor.createEmbeddedDocument('OwnedItem', new_spells);
  //   }
  //   await actor.update({ data: data });
  //   await actor.setFlag('pbta', 'levelup', false);
  //   // actor.render(true);
  // }

  // /**
  //  * Listen for click events on spells.
  //  * @param {MouseEvent} event
  //  */
  // async _onPrepareSpell(event) {
  //   event.preventDefault();
  //   const a = event.currentTarget;
  //   const data = a.dataset;
  //   const actorData = this.actor.data.data;
  //   const itemId = $(a).parents('.item').attr('data-item-id');
  //   const item = this.actor.getOwnedItem(itemId);

  //   if (item) {
  //     let $self = $(a);
  //     $self.toggleClass('unprepared');

  //     let update = { _id: item._id, "data.prepared": !item.data.data.prepared };
  //     await this.actor.updateEmbeddedDocument("OwnedItem", update);

  //     this.render();
  //   }
  // }

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
      let originalAmount = getProperty(item.data.toObject(), property) ?? 0;
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
      item.roll();
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
    const data = {};
    const actor = this.actor;
    if (dataset.movetype) {
      data.moveType = dataset.movetype;
    }
    if (dataset.equipmenttype) {
      data.equipmentType = dataset.equipmenttype;
    }
    if (dataset.level) {
      data.spellLevel = dataset.level;
    }
    const name = type == 'bond' ? game.i18n.localize("PBTA.BondDefault") : `New ${type.capitalize()}`;
    let itemData = {
      name: name,
      type: type,
      data: data
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
    if (this.token && !this.token.data.actorLink) {
      this.actor.update(updateData, mergeObject(options, { diff: false }));
    }
    else {
      this.actor.update(updateData, options);
    }
  }

  /* -------------------------------------------- */

  async _activateTagging(html) {
    // Build the tags list.
    let tags = game.items.filter(item => item.type == 'tag');
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
    var $input = html.find('input[name="data.tags"]');
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
