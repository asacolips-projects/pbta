export class PbtaUtility {
  static cleanClass(string, hyphenate = true) {
    let replace = hyphenate ? '-' : '';
    //Lower case everything
    string = string.toLowerCase();
    //Make alphanumeric (removes all other characters)
    string = string.replace(/[^a-z0-9\s]/g, "");
    //Convert whitespaces and underscore to dash
    string = string.replace(/[\s\_]/g, replace);
    //Clean up multiple dashes or whitespaces
    string = string.replace(/[\s\-]+/g, replace);
    return string;
  };

  static isEmpty(arg) {
    return [null, false, undefined, 0, ''].includes(arg);
  }

  static convertAttr(attrGroup) {
    let attrs = {};
    for (let [attrKey, attrValue] of Object.entries(attrGroup)) {
      let attr = {};

      attr.label = attrValue.label ?? attrKey;

      if (!attrValue.type) {
        // If an object structure was used and no type was specified, it's invalid.
        if (typeof attrValue == 'object') {
          continue;
        }
        // Otherwise, conver the value into the type (short syntax).
        let val = attrValue;
        attrValue = { type: val, value: '' };
      }

      if (attrValue.type == 'Number') {}

      switch (attrValue.type) {
        case "Number":
          attr.type = attrValue.type;
          attr.value = 0;
          break;

        case "Clock":
          attr.type = attrValue.type;
          attr.value = 0;
          attr.max = attrValue.max ?? 0;
          attr.steps = [];
          if (attr.max) {
            for (let i = 0; i < attr.max; i++) {
              attr.steps.push(false);
            }
          }
          break;

        case 'Xp':
          attr.type = attrValue.type;
          attr.value = 0;
          attr.max = attrValue.max ?? 0;
          attr.steps = [];
          if (attr.max) {
            for (let i = 0; i < attr.max; i++) {
              attr.steps.push(false);
            }
          }
          break;

        case 'Resource':
          attr.type = attrValue.type;
          attr.value = 0;
          attr.max = attrValue.max ?? 0;
          break;

        case 'Text':
          attr.type = attrValue.type;
          attr.value = '';
          break;

        case 'LongText':
          attr.type = attrValue.type;
          attr.value = '';
          break;

        case 'Checkbox':
          attr.type = attrValue.type;
          attr.checkboxLabel = attrValue.checkboxLabel ?? false;
          attr.value = false;
          break;

        case 'Roll':
          attr.type = attrValue.type;
          attr.value = attrValue.default ?? '';
          break;

        default:
          break;
      }

      attrs[attrKey] = attr;
    }

    return attrs;
  }

  static applyActorTemplates() {
    let templates = game.system.template.Actor;
    let actorTypes = game.system.template.Actor.types;

    for (let type of actorTypes) {
      if (game.pbta.sheetConfig.actorTypes[type]) {
        let template = {};
        let v = game.pbta.sheetConfig.actorTypes[type];

        if (v.stats) template.stats = v.stats;
        if (v.attrTop) template.attrTop = v.attrTop;
        if (v.attrLeft) template.attrLeft = v.attrLeft;

        let orig = duplicate(templates[type]);
        templates[type] = mergeObject(orig, template);
      }
    }
  }

  static getRollFormula(defaultFormula = '2d6') {
    return game.pbta.sheetConfig.rollFormula ?? defaultFormula;
  }

  static async getEquipment(update = false) {
    if (typeof game.items == 'undefined') {
      return false;
    }

    // Cache results.
    if (game.pbta.equipment && !update) {
      return game.pbta.equipment;
    }

    // Load new results.
    let items = game.items.filter(i => i.type == 'equipment');
    for (let pack of game.packs) {
      if (pack.metadata.name.includes('equipment')) {
        if (pack) {
          items = items.concat(await pack.getContent());
        }
      }
    }

    game.pbta.equipment = items;

    return items;
  }

  static getAbilityMod(abilityScore) {
    let abilityMod = 0;

    if (abilityScore >= 18) {
      abilityMod = 3;
    }
    else if (abilityScore > 15) {
      abilityMod = 2;
    }
    else if (abilityScore > 12) {
      abilityMod = 1;
    }
    else if (abilityScore > 8) {
      abilityMod = 0;
    }
    else if (abilityScore > 5) {
      abilityMod = -1;
    }
    else if (abilityScore > 3) {
      abilityMod = -2;
    }
    else {
      abilityMod = -3;
    }

    return abilityMod;
  }

  static getProgressCircle({ current = 100, max = 100, radius = 16 }) {
    let circumference = radius * 2 * Math.PI;
    let percent = current < max ? current / max : 1;
    let percentNumber = percent * 100;
    let offset = circumference - (percent * circumference);
    let strokeWidth = 4;
    let diameter = (radius * 2) + strokeWidth;
    let colorClass = Math.round((percent * 100) / 10) * 10;

    return {
      radius: radius,
      diameter: diameter,
      strokeWidth: strokeWidth,
      circumference: circumference,
      offset: offset,
      position: diameter / 2,
      color: 'red',
      class: colorClass,
    };
  }

  static replaceRollData() {
    // /**
    //  * Override the default getRollData() method to add abbreviations for the
    //  * abilities and attributes properties.
    //  */
    // const original = Actor.prototype.getRollData;
    // Actor.prototype.getRollData = function() {
    //   // Use the actor by default.
    //   let actor = this;

    //   // Use the current token if possible.
    //   let token = canvas.tokens.controlled.find(t => t.actor.data._id == this.data._id);
    //   if (token) {
    //     actor = token.actor;
    //   }

    //   const data = original.call(actor);

    //   // Re-map all attributes onto the base roll data
    //   let newData = mergeObject(data.attributes, data.stats);
    //   delete data.init;
    //   for (let [k, v] of Object.entries(newData)) {
    //     switch (k) {
    //       // case 'level':
    //       //   data.lvl = v.value;
    //       //   break;

    //       default:
    //         if (!(k in data)) {
    //           v.val = v.value;
    //           delete v.value;
    //           data[k] = v;
    //         }
    //         break;
    //     }
    //   }

    //   // Old syntax shorthand.
    //   data.attr = data.attributes;
    //   data.abil = data.stats;
    //   return data;
    // };
  }
}