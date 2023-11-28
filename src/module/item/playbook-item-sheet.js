import { PbtaUtility } from "../utility.js";
import { PbtaItemSheet } from './item-sheet.js';

/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export class PbtaPlaybookItemSheet extends PbtaItemSheet {

  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["pbta", "sheet", "item", "class"],
      width: 780,
      height: 480,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "equipment" }],
      submitOnChange: true,
    });
  }
}