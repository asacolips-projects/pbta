/**
 * A simple and flexible system for world-building using an arbitrary collection of character and item attributes
 * Author: Atropos
 * Software License: GNU GPLv3
 */

// Import Modules
import { PBTA } from "./config.js";
import { PbtaPlaybooks } from "./config.js";
import { ActorPbta } from "./actor/actor.js";
import { ItemPbta } from "./item/item.js";
import { PbtaItemSheet } from "./item/item-sheet.js";
import { PbtaActorSheet } from "./actor/actor-sheet.js";
import { PbtaActorOtherSheet } from "./actor/actor-other-sheet.js";
import { PbtaActorNpcSheet } from "./actor/actor-npc-sheet.js";
import { PbtaPlaybookItemSheet } from "./item/playbook-item-sheet.js";
import { PbtaRegisterHelpers } from "./handlebars.js";
import { PbtaUtility } from "./utility.js";
import { PbtaRolls } from "./rolls.js";
import { CombatSidebarPbta } from "./combat/combat.js";
import { MigratePbta } from "./migrate/migrate.js";
import { PbtaSettingsConfigDialog } from "./settings/settings.js";
import { PbtaActorTemplates } from "./pbta/pbta-actors.js";
import { preloadHandlebarsTemplates } from "./templates.js";

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */

Hooks.once("init", async function() {
  console.log(`Initializing Powered by the Apocalypse!`);

  game.pbta = {
    ActorPbta,
    ItemPbta,
    rollItemMacro,
    PbtaUtility,
    PbtaActorTemplates,
    MigratePbta,
    PbtaSettingsConfigDialog,
    PbtaRolls
  };

  // TODO: Extend the combat class.
  // CONFIG.Combat.entityClass = CombatPbta;

  CONFIG.PBTA = PBTA;
  CONFIG.Actor.documentClass = ActorPbta;
  CONFIG.Item.documentClass = ItemPbta;

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("pbta", PbtaActorSheet, {
    types: ['character'],
    makeDefault: true
  });
  Actors.registerSheet("pbta", PbtaActorOtherSheet, {
    types: ['other'],
    makeDefault: true
  });
  Actors.registerSheet("pbta", PbtaActorNpcSheet, {
    types: ['npc'],
    makeDefault: true
  });
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("pbta", PbtaItemSheet, { makeDefault: false });
  Items.registerSheet("pbta", PbtaPlaybookItemSheet, {
    types: ['playbook'],
    makeDefault: true
  });

  PbtaRegisterHelpers.init();

  // Combat tracker.
  let combatPbta = new CombatSidebarPbta();
  combatPbta.startup();

  /**
   * Track the system version upon which point a migration was last applied
   */
  game.settings.register("pbta", "systemMigrationVersion", {
    name: "System Migration Version",
    scope: "world",
    config: false,
    type: Number,
    default: 0
  });

  game.settings.register("pbta", "advForward", {
    name: game.i18n.localize("PBTA.Settings.advForward.name"),
    hint: game.i18n.localize("PBTA.Settings.advForward.hint"),
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.registerMenu("pbta", "sheetConfigMenu", {
    name: game.i18n.localize("PBTA.Settings.sheetConfig.name"),
    label: game.i18n.localize("PBTA.Settings.sheetConfig.label"),
    hint: game.i18n.localize("PBTA.Settings.sheetConfig.hint"),
    icon: "fas fa-bars",               // A Font Awesome icon used in the submenu button
    type: PbtaSettingsConfigDialog,   // A FormApplication subclass which should be created
    restricted: true,                   // Restrict this submenu to gamemaster only?
    scope: 'world'
  });

  game.settings.register("pbta", "sheetConfig", {
    name: "PBTA Sheet Config",
    scope: "world",
    config: false,
    type: Object,
    default: 0
  });

  PbtaUtility.replaceRollData();

  // Build out character data structures.
  const pbtaSettings = game.settings.get('pbta', 'sheetConfig');

  // Update stored config.
  game.pbta.sheetConfig = pbtaSettings.computed ? PbtaUtility.convertSheetConfig(pbtaSettings.computed) : pbtaSettings;

  // Preload template partials.
  preloadHandlebarsTemplates();
});

Hooks.once("ready", async function() {
  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on("hotbarDrop", (bar, data, slot) => createPbtaMacro(data, slot));

  PBTA.playbooks = await PbtaPlaybooks.getPlaybooks();
  CONFIG.PBTA = PBTA;

  // Apply structure to actor types.
  PbtaUtility.applyActorTemplates();

  // Add a lang class to the body.
  const lang = game.settings.get('core', 'language');
  $('html').addClass(`lang-${lang}`);

  // Run migrations.
  MigratePbta.runMigration();
});

Hooks.on('renderChatMessage', (data, html, options) => {
  // Determine visibility.
  let chatData = data.data;
  const whisper = chatData.whisper || [];
  const isBlind = whisper.length && chatData.blind;
  const isVisible = (whisper.length) ? game.user.isGM || whisper.includes(game.user.id) || (!isBlind) : true;
  if (!isVisible) {
    html.find('.dice-formula').text('???');
    html.find('.dice-total').text('?');
    html.find('.dice-tooltip').remove();
  }
});

/* -------------------------------------------- */
/*  Foundry VTT Setup                           */
/* -------------------------------------------- */

/**
 * This function runs after game data has been requested and loaded from the servers, so entities exist
 */
Hooks.once("setup", function() {

  // Localize CONFIG objects once up-front
  const toLocalize = [
    "abilities", "debilities"
  ];
  for (let o of toLocalize) {
    CONFIG.PBTA[o] = Object.entries(CONFIG.PBTA[o]).reduce((obj, e) => {
      obj[e[0]] = game.i18n.localize(e[1]);
      return obj;
    }, {});
  }
});

/* -------------------------------------------- */
/*  Help Button                                 */
/* -------------------------------------------- */

Hooks.on("renderSettings", (app, html) => {
  let settingsButton = $(`<button id="pbta-settings-btn" data-action="pbta-settings"><i class="fas fa-file-alt"></i> ${game.i18n.localize("PBTA.Settings.sheetConfig.label")}</button>`);
  html.find('button[data-action="configure"]').before(settingsButton);

  let helpButton = $(`<button id="pbta-help-btn" data-action="pbta-help"><i class="fas fa-question-circle"></i> ${game.i18n.localize("PBTA.Settings.button.help")}</button>`);
  html.find('button[data-action="controls"]').after(helpButton);

  settingsButton.on('click', ev => {
    ev.preventDefault();
    let menu = game.settings.menus.get('pbta.sheetConfigMenu');
    let app = new menu.type();
    app.render(true);
  });

  helpButton.on('click', ev => {
    ev.preventDefault();
    window.open('https://asacolips.gitbook.io/pbta-system/', 'pbtaHelp', 'width=1032,height=720');
  });
});


/* -------------------------------------------- */
/*  Level Up Listeners                          */
/* -------------------------------------------- */
Hooks.on('renderDialog', (dialog, html, options) => {
  // If this is the levelup dialog, we need to add listeners to it.
  if (dialog.data.id && dialog.data.id == 'level-up') {
    // If an ability score is chosen, we need to update the available options.
    html.find('.cell--ability-scores select').on('change', () => {
      // Build the list of selected score values.
      let scores = [];
      html.find('.cell--ability-scores select').each((index, item) => {
        let $self = $(item);
        if ($self.val()) {
          scores.push($self.val());
        }
      });
      // Loop over the list again, disabling invalid options.
      html.find('.cell--ability-scores select').each((index, item) => {
        let $self = $(item);
        // Loop over the options in the select.
        $self.find('option').each((opt_index, opt_item) => {
          let $opt = $(opt_item);
          let val = $opt.attr('value');
          if (val) {
            if (scores.includes(val) && $self.val() != val) {
              $opt.attr('disabled', true);
            }
            else {
              $opt.attr('disabled', false);
            }
          }
        });
      });
    })
  }
});

/* -------------------------------------------- */
/*  Hotbar Macros                               */
/* -------------------------------------------- */

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
async function createPbtaMacro(data, slot) {
  if (data.type !== "Item") return;
  if (!("data" in data)) return ui.notifications.warn("You can only create macro buttons for owned Items");
  const item = data.data;

  // Create the macro command
  const command = `game.pbta.rollItemMacro("${item.name}");`;
  let macro = game.macros.contents.find(m => (m.name === item.name) && (m.command === command));
  if (!macro) {
    macro = await Macro.create({
      name: item.name,
      type: "script",
      img: item.img,
      command: command,
      flags: { "pbta.itemMacro": true }
    });
  }
  game.user.assignHotbarMacro(macro, slot);
  return false;
}

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {string} itemName
 * @return {Promise}
 */
function rollItemMacro(itemName) {
  const speaker = ChatMessage.getSpeaker();
  let actor;
  if (speaker.token) actor = game.actors.tokens[speaker.token];
  if (!actor) actor = game.actors.get(speaker.actor);
  const item = actor ? actor.items.find(i => i.name === itemName) : null;
  if (!item) return ui.notifications.warn(`Your controlled Actor does not have an item named ${itemName}`);

  // Trigger the item roll
  // if ( item.data.type === "spell" ) return actor.useSpell(item);
  return item.roll();
}

/* -------------------------------------------- */
/*  Entity Creation Override                    */
/* -------------------------------------------- */

async function _onCreateEntity(event) {
  event.preventDefault();
  event.stopPropagation();
  return _pbtaDirectoryTemplates(this, event);
}

if (typeof ActorDirectory.prototype._onCreateEntity !== 'undefined') {
  ActorDirectory.prototype._onCreateEntity = _onCreateEntity; // For 0.7.x
}
else if (typeof ActorDirectory.prototype._onCreateDocument !== 'undefined') {
  ActorDirectory.prototype._onCreateDocument = _onCreateEntity; // For 0.8.x+
}

/**
 * Display the entity template dialog.
 *
 * Helper function to display a dialog if there are multiple template types defined for the entity type.
 * TODO: Refactor in 0.7.x to play more nicely with the Entity.createDialog method
 *1
 * @param {EntityCollection} entityType - The sidebar tab
 * @param {MouseEvent} event - Triggering event
 */
 async function _pbtaDirectoryTemplates(collection, event) {

  // Retrieve the collection and find any available templates
  const entityCollection = collection.tabName === "actors" ? game.actors : game.items;
  const cls = collection.tabName === "actors" ? Actor : Item;
  // let templates = entityCollection.filter(a => a.getFlag("worldbuilding", "isTemplate"));
  let ent = game.i18n.localize(cls.config.label);

  let actorTypes = Object.keys(game.pbta.sheetConfig.actorTypes);

  // Setup default creation data
  let type = collection.tabName === "actors" ? 'character' : 'item';
  let name = `${game.i18n.localize("PBTA.New")} ${ent}`;

  // Build an array of types for the form, including an empty default.
  let types = actorTypes.map(a => {
    // TODO: Make these values different.
    return {
      value: a,
      type: a == 'character' || a == 'npc' ? a : 'other',
      label: a
    }
  });

  // Render the confirmation dialog window
  const templateData = {upper: ent, lower: ent.toLowerCase(), types: types};
  const dlg = await renderTemplate(`systems/pbta/templates/sidebar/entity-create.html`, templateData);
  return Dialog.confirm({
    title: `${game.i18n.localize("PBTA.Create")} ${name}`,
    content: dlg,
    yes: html => {
      const form = html[0].querySelector("form");
      // First we need to find the base actor type to model this after.
      let actorType = form.type.value;
      let baseType = actorType == 'character' || actorType == 'npc' ? actorType : 'other';
      let tplBase = {};
      // Set the custom type.
      if (baseType == 'other') {
        tplBase.customType = actorType;
      }
      // Initialize create data on the object.
      let createData = {
        name: name,
        type: baseType,
        data: foundry.utils.deepClone(tplBase),
        folder: event.currentTarget.dataset.folder
      };
      createData.name = form.name.value;
      // Create the actor.
      return cls.create(createData, {renderSheet: true});
    },
    no: () => {},
    defaultYes: false,
    render: html => {
      html.on('keydown', function(event) {
        if (event.key == 'Enter') {
          event.preventDefault();
          html.find('button.yes').trigger('click');
        }
      });
    }
  });
}