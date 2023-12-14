export class PbtACombatant extends Combatant {
	async _preCreate(data, options, user) {
		if (!data.initiative) {
			let highestInit = 0;
			let token = canvas.tokens.get(data.tokenId);
			let actorType = token.actor ? token.actor.type : "character";

			// Iterate over actors of this type and update the initiative of this
			// actor based on that.
			this.parent.combatants.filter((c) => c.actor.type === actorType).forEach((c) => {
				let init = Number(c.initiative);
				if (init >= highestInit) {
					highestInit = init + 10;
				}
			});

			// Update this combatant.
			this.updateSource({initiative: highestInit});
		}
	}
}
