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

}