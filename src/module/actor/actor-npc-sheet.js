import { PbtaActorSheet } from './actor-sheet.js';

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class PbtaActorNpcSheet extends PbtaActorSheet {

  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["pbta", "sheet", "actor", "npc"],
      width: 720,
      height: 640,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-tabs-content", initial: "moves" }],
    });
  }

  static unsupportedItemTypes = new Set(["move", "playbook"]);

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
}