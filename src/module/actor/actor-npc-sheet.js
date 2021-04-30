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

}