import { PBTA } from "./config.js";
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

  static toTitleCase(str) {
    return str.replace(
      /\w*/g,
      function(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
      }
    );
  }

  static isEmpty(arg) {
    return [null, false, undefined, 0, ''].includes(arg);
  }

  static convertSheetConfig(sheetConfig) {
    const newConfig = {};

    for (let [k,v] of Object.entries(sheetConfig)) {
      if (k == 'rollFormula') {
        let rollFormula = v;
        let validRoll = new Roll(rollFormula.trim()).evaluate({async: false});
        newConfig.rollFormula = validRoll ? rollFormula.trim() : '';
      }

      if (k == 'statToggle') {
        if (!v) {
          newConfig.statToggle = false;
        }
        else {
          if (typeof v == 'object' && v.label) {
            newConfig.statToggle = {
              label: v.label,
              modifier: v.modifier ? v.modifier : 0
            }
          }
          else {
            newConfig.statToggle = {
              label: v,
              modifier: 0
            };
          }
        }
      }

      if (k == "rollResults") {
        newConfig.rollResults = {};
        // Set result ranges.
        for (let [rollKey, rollSetting] of Object.entries(v)) {
          if (typeof rollSetting.range == 'string') {
            // Exit early if the range type isn't specified.
            if (!rollSetting.range) {
              continue;
            }

            // Split the result range into an array.
            let range = rollSetting.range.split(/[\-\+]/g);
            let rollResult = {};

            // If the array is invalid, exit early.
            if (range.length != 2 || range[0] === "") {
              continue;
            }

            // Get the start and end numbers. Start should always be numeric,
            // e.g. 6- rather than -6.
            let start = Number(range[0]);
            let end = range[1] !== "" ? Number(range[1]) : null;

            // If there's only one digit, assume it's N+ or N-.
            if (end === null) {
              // If it's minus, set the start to null (less than or equal).
              if (rollSetting.range.includes('-')) {
                rollResult = {
                  start: null,
                  end: start,
                  label: rollSetting.label
                };
              }

              // If it's plus, set the end to null (greater than or equal).
              if (rollSetting.range.includes('+')) {
                rollResult = {
                  start: start,
                  end: null,
                  label: rollSetting.label
                };
              }
            }
            // Otherwise, set the full range.
            else {
              rollResult = {
                start: start,
                end: end,
                label: rollSetting.label
              };
            }

            // Update teh sheet config with this result range.
            newConfig.rollResults[rollKey] = rollResult;
          }
        }
      }

      // Actors.
      if (v.stats || v.attributesTop || v.attributesLeft || v.moveTypes || v.equipmentTypes) {
        let actorType = {};
        if (v.stats) {
          actorType.stats = {};
          for (let [statKey, statLabel] of Object.entries(v.stats)) {
            let cleanKey = PbtaUtility.cleanClass(statKey, false);
            if (['ask', 'formula', 'prompt'].includes(cleanKey)) continue;

            actorType.stats[cleanKey] = {
              label: statLabel,
              value: 0
            };
          }
        }

        if (v.attributesTop) actorType.attrTop = PbtaUtility.convertAttr(v.attributesTop);
        if (v.attributesLeft) actorType.attrLeft = PbtaUtility.convertAttr(v.attributesLeft);

        if (v.moveTypes) {
          actorType.moveTypes = {};
          for (let [mtKey, mtLabel] of Object.entries(v.moveTypes)) {
            actorType.moveTypes[PbtaUtility.cleanClass(mtKey, false)] = {
              label: mtLabel,
              moves: []
            };
          }
        }

        if (v.equipmentTypes) {
          actorType.equipmentTypes = {};
          for (let [etKey, etLabel] of Object.entries(v.equipmentTypes)) {
            actorType.equipmentTypes[PbtaUtility.cleanClass(etKey, false)] = {
              label: etLabel,
              moves: []
            };
          }
        }

        if (k !== 'character' && k !== 'npc') {
          actorType.baseType = 'character';
          if (v.baseType) {
            actorType.baseType = v.baseType;
          }
          else if (v.basetype) {
            actorType.baseType = v.basetype;
          }
        }

        delete v.attributesTop;
        delete v.attributesLeft;

        if (!newConfig.actorTypes) newConfig.actorTypes = {};
        newConfig.actorTypes[k] = actorType;
      }
    }

    // Update stored config.
    return newConfig;
  }

  static convertAttr(attrGroup) {
    let attrs = {};
    for (let [attrKey, attrValue] of Object.entries(attrGroup)) {
      let attr = {};

      attr.label = attrValue.label ?? this.toTitleCase(attrKey);
      attr.description = attrValue.description ?? null;
      attr.customLabel = attrValue.customLabel ?? false;
      attr.userLabel = attr.customLabel ? attr.label : false;

      if (!attrValue.type) {
        // If an object structure was used and no type was specified, it's invalid.
        if (typeof attrValue == 'object') {
          continue;
        }
        // Otherwise, conver the value into the type (short syntax).
        let val = attrValue;
        attrValue = { type: val, value: '' };
      }

      if (!PBTA.attrTypes.includes(attrValue.type)) {
        continue;
      }

      switch (attrValue.type) {
        case "Number":
          attr.type = attrValue.type;
          attr.value = attrValue.default ?? 0;
          break;

        case "Clock":
          attr.type = attrValue.type;
          attr.value = attrValue.default ?? 0;
          attr.max = attrValue.max ?? 0;
          attr.steps = [];
          if (attr.max) {
            for (let i = 0; i < attr.max; i++) {
              attr.steps.push(i < attr.value);
            }
          }
          break;

        case 'Xp':
          attr.type = attrValue.type;
          attr.value = attrValue.default ?? 0;
          attr.max = attrValue.max ?? 0;
          attr.steps = [];
          if (attr.max) {
            for (let i = 0; i < attr.max; i++) {
              attr.steps.push(i < attr.value);
            }
          }
          break;

        case 'Resource':
          attr.type = attrValue.type;
          attr.value = attrValue.default ?? 0;
          attr.max = attrValue.max ?? 0;
          break;

        case 'Text':
          attr.type = attrValue.type;
          attr.value = attrValue.default ?? '';
          break;

        case 'LongText':
          attr.type = attrValue.type;
          attr.value = attrValue.default ?? '';
          break;

        case 'Checkbox':
          attr.type = attrValue.type;
          attr.checkboxLabel = attrValue.checkboxLabel ?? false;
          attr.value = attrValue.default ?? false;
          break;

        case 'ListMany':
          attr.type = attrValue.type;

          let options = {};
          if (attrValue.options) {
            // Handle options if provided as an array.
            if (Array.isArray(attrValue.options)) {
              let i = 0;
              for (let optV of attrValue.options) {
                options[i] = {
                  label: optV,
                  value: false
                };
                i++;
              }
            }
            // Handle options if provided as an object (keyed array).
            else if (typeof attrValue.options == 'object') {
              for (let [optK, optV] of Object.entries(attrValue.options)) {
                options[optK] = {
                  label: optV,
                  value: false
                };
              }
            }
            // Handle special options.
            for (let [optK, optV] of Object.entries(options)) {
              let optCount = optV.label.match(/(\|)(\d)/);
              if (optCount && optCount[2] && Number.isNumeric(optCount[2])) {
                let subOptV = {};
                for (let subOptK = 0; subOptK < optCount[2]; subOptK++) {
                  subOptV[subOptK] = {
                    value: false
                  };
                }
                options[optK]['values'] = subOptV;
                options[optK]['label'] = optV.label.split('|')[0];
              }
            }
          }

          attr.condition = attrValue.condition ?? false;
          attr.options = options;
          break;

        // TODO: Add ListOne type.
        // case 'ListOne':
        //   attr.type = attrValue.type;
        //   attr.options = attrValue.options && typeof attrValue.options == 'object' ? attrValue.options : {};
        //   attr.value = null;
        //   break;

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
    let templates = game.system.model.Actor;
    let actorTypes = Object.keys(templates);

    if (!game.pbta.sheetConfig) return;

    if (!game.pbta.sheetConfig.actorTypes) {
      let menu = game.settings.menus.get('pbta.sheetConfigMenu');
      let app = new menu.type();
      app.render(true);
      return false;
    }

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
          let packItems = await pack.getDocuments;
          items = items.concat(packItems);
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
}