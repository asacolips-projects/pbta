import { PbtaActorSheet } from './actor-sheet.js';

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class PbtaActorOtherSheet extends PbtaActorSheet {

  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["pbta", "sheet", "actor", "other"],
      width: 840,
      height: 780,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-tabs-content", initial: "moves" }],
    });
  }

  /** @override */
  get template() {
    const path = "systems/pbta/templates/sheet";
    // Handle actor types.
    let sheetType = this.actor.data.data?.customType ?? null;
    let baseType = game.pbta.sheetConfig.actorTypes[sheetType]?.baseType ?? 'character';
    // Returns a format such as `character-sheet.html` or `other-character-sheet.html`.
    return `${path}/other-${baseType}-sheet.html`;
  }

  /** @override */
  constructor(...args) {
    super(...args);

    let sheetType = this.actor.data.data?.customType ?? null;
    let baseType = game.pbta.sheetConfig.actorTypes[sheetType]?.baseType ?? 'character';

    if (baseType == 'npc') {
      this.options.classes.push('npc');

      this.options.width = 720;
      this.options.height = 640;

      this.position.width = 720;
      this.position.height = 640;
    }
    else {
      this.options.classes.push('character');
    }
  }

}