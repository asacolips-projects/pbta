export class PbtACombatTracker extends CombatTracker {
	/** @inheritdoc */
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			template: "systems/pbta/templates/combat/combat-tracker.html",
		});
	}

	async getData(options={}) {
		let data = await super.getData(options);
		const combatantGroups = this.getCombatantGroups();
		let moveTotal = 0;
        if (combatantGroups.character) {
			combatantGroups.character.forEach(c => {
				c.flags = c.flags;
				moveTotal = c?.flags?.pbta ? moveTotal + Number(c.getFlag('pbta', 'moveCount') || 0) : moveTotal;
			});
        }
		const labels = Object.keys(game.pbta?.sheetConfig?.actorTypes).reduce((obj, key) => {
			obj[key] = game.i18n.localize(game.pbta.sheetConfig.actorTypes[key]?.label)
				?? game.i18n.localize(`TYPES.Actor.${key}`);
			return obj;
		}, {})
		return {
			...data,
			labels,
			combatants: combatantGroups,
			moveTotal
		}
	};

	/**
	 * Retrieve a list of combatants for the current combat.
	 *
	 * Combatants will be sorted into groups by actor type. Set the
	 * updateInitiative argument to true to reassign init numbers.
	 * @param {Boolean} updateInitiative
	 */
	getCombatantGroups(updateInitiative = false) {
		// If there isn't a combat, exit and return an empty array.
		if (!game.combat) {
			return [];
		}

		let currentInitiative = 0;
		// Reduce the combatants array into a new object with keys based on
		// the actor types.
		let combatants = game.combat.combatants.reduce((groups, combatant) => {
			let isOwner = combatant.isOwner;
			// If this is for a combatant that has had its token/actor deleted,
			// remove it from the combat.
			if (!combatant.actor) {
				game.combat.deleteEmbeddedDocuments('Combatant', [combatant.id]);
			}
			// Append valid actors to the appropriate group.
			else {
				// Initialize the group if it doesn't exist.
				let group = combatant.actor.type;
				if (!groups[group]) {
					groups[group] = [];
				}

				// If the updateInitiative flag was set to true, recalculate the
				// initiative for each actor while we're looping through them.
				if (group != 'character' && updateInitiative) {
					combatant.initiative = currentInitiative;
					currentInitiative = currentInitiative + 10;
				}

				// Set a property for whether or not this is editable. This controls
				// whether editabel fields like HP will be shown as an input or a div
				// in the combat tracker HTML template.
				combatant.editable = isOwner || game.user.isGM;
				const resource = combatant.permission >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER ? combatant.resource : null;
				if (resource) {
					combatant.resource = resource;
					combatant.hasResource = resource !== null;
				}

				// If this is the GM or the owner, push to the combatants list.
				// Otherwise, only push if the token isn't hidden in the scene.
				if (game.user.isGM || isOwner || !combatant.token.hidden) {
					groups[group].push(combatant);
				}
			}

			// Return the updated group.
			return groups;
		}, {});

		// Sort the combatants in each group by initiative.
		for (let [groupKey, group] of Object.entries(combatants)) {
			combatants[groupKey].sort((a, b) => {
			return Number(a.initiative) - Number(b.initiative)
			});
		}

		// Return the list of combatants.
		return combatants;
	}

	/** @inheritdoc */
	activateListeners(html) {
		super.activateListeners(html);
		const tracker = html.find("#combat-tracker");
		const combatants = tracker.find(".combatant");

		if (!game.user.isGM) return;

		combatants.on('dragstart', (event) => {
			// Set the drag data for later usage.
			let dragData = event.currentTarget.dataset;
			event.originalEvent.dataTransfer.setData('text/plain', JSON.stringify(dragData));

			// Store the combatant type for reference. We have to do this
			// because dragover doesn't have access to the drag data, so we
			// store it as a new type entry that can be split later.
			let combatants = game.combat.combatants;
			let newCombatant = combatants.find(c => c.id == dragData.combatantId);
			event.originalEvent.dataTransfer.setData(`newtype--${dragData.actorType}`, '');
        })
		// Add a class on hover, if the actor types match.
		combatants.on('dragover', (event) => {
            // Get the drop target.
            let $self = $(event.originalEvent.target);
            let $dropTarget = $self.parents('.directory-item');

            // Exit early if we don't need to make any changes.
            if ($dropTarget.hasClass('drop-hover')) {
              return;
            }

            if (!$dropTarget.data('combatant-id')) {
              return;
            }

            // Retrieve the actor type for the drop target, exit early if
            // it doesn't exist.
            let oldType = $dropTarget.data('actor-type');
            let newType = null;

            if (!oldType) {
              return;
            }

            // Retrieve the actor type for the actor being dragged.
            newType = event.originalEvent.dataTransfer.types.find(t => t.includes('newtype'));
            newType = newType ? newType.split('--')[1] : null;

            // If the type matches, add a css class to let the user know this
            // is a valid drop target.
            if (newType == oldType) {
              $dropTarget.addClass('drop-hover');
            }
            // Otherwise, we should exit.
            else {
              return false;
            }

            return false;
		})
		// Remove the class on drag leave.
		combatants.on('dragleave', (event) => {
			// Get the drop target and remove any hover classes on it when
			// the mouse leaves it.
			let $self = $(event.originalEvent.target);
			let $dropTarget = $self.parents('.directory-item');
			$dropTarget.removeClass('drop-hover');
			return false;
		})
		// Update initiative on drop.
		combatants.on('drop', async (event) => {
			// Retrieve the default encounter.
			let combat = game.combat;

			// TODO: This is how foundry.js retrieves the combat in certain
			// scenarios, so I'm leaving it here as a comment in case this
			// needs to be refactored.
			// ---------------------------------------------------------------
			// const view = game.scenes.viewed;
			// const combats = view ? game.combats.filter(c => c.data.scene === view.id) : [];
			// let combat = combats.length ? combats.find(c => c.data.active) || combats[0] : null;

			// Retreive the drop target, remove any hover classes.
			let $self = $(event.originalEvent.target);
			let $dropTarget = $self.parents('.directory-item');
			$dropTarget.removeClass('drop-hover');

			// Attempt to retrieve and parse the data transfer from the drag.
			let data;
			try {
				data = JSON.parse(event.originalEvent.dataTransfer.getData('text/plain'));
				// if (data.type !== "Item") return;
			} catch (err) {
				return false;
			}

			// Retrieve the combatant being dropped.
			let newCombatant = combat.combatants.find(c => c.id == data.combatantId);

			// Retrieve the combatants grouped by type.
			let combatants = this.getCombatantGroups(false);
			// Retrieve the combatant being dropped onto.
			let originalCombatant = combatants[newCombatant.actor.type].find(c => {
				return c.id == $dropTarget.data('combatant-id');
			});

			// Set the initiative equal to the drop target's initiative.
			let oldInit = originalCombatant ? originalCombatant.initiative : null;

			// If the initiative was valid, we need to update the initiative
			// for every combatant to reset their numbers.
			if (oldInit !== null) {
				// Set the initiative of the actor being draged to the drop
				// target's +1. This will later be adjusted increments of 10.
				let updatedCombatant = combatants[newCombatant.actor.type].find(c => c.id == newCombatant.id);
				updatedCombatant.initiative = Number(oldInit) + 1;

				// Loop through all combatants in initiative order, and assign
				// a new initiative in increments of 10. The "updates" variable
				// will be an array of objects iwth _id and initiative keys.
				let updatedInit = 0;
				let updates = combatants[newCombatant.actor.type].sort((a, b) => a.initiative - b.initiative).map(c => {
				let result = {
					_id: c.id,
					initiative: updatedInit
				};
				updatedInit = updatedInit + 10;
					return result;
				});

				// If there are updates, update the combatants at once.
				if (updates) {
					await combat.updateEmbeddedDocuments('Combatant', updates, {});
				}
			}
		});
	}
}