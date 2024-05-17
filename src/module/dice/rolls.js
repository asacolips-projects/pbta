export default class RollPbtA extends Roll {
	static EVALUATION_TEMPLATE = "systems/pbta/templates/chat/roll-dialog.html";

	/**
	 * A convenience reference for whether this RollPbtA has advantage
	 * @type {boolean}
	 */
	get hasAdvantage() {
		const { modifier } = game.pbta.sheetConfig.statToggle;
		const toggle = this.data.stats[this.options.stat]?.toggle;
		if (this.options.rollMode === "adv") return true;
		if (modifier === "adv") return toggle;
		return false;
	}

	/* -------------------------------------------- */

	/**
	 * A convenience reference for whether this RollPbtA has disadvantage
	 * @type {boolean}
	 */
	get hasDisadvantage() {
		const { modifier } = game.pbta.sheetConfig.statToggle;
		const toggle = this.data.stats[this.options.stat]?.toggle;
		if (this.options.rollMode === "dis") return true;
		if (modifier === "dis") return toggle;
		return false;
	}

	/** @override */
	async toMessage(messageData={}, { rollMode, create=true }={}) {

		// Perform the roll, if it has not yet been rolled
		if (!this._evaluated) {
			await this.evaluate({ async: true });
		}

		const resultRanges = game.pbta.sheetConfig.rollResults;
		let resultLabel = null;
		let resultDetails = null;
		let resultType = null;
		let stat = this.options.stat;
		let statMod;

		// Iterate through each result range until we find a match.
		for (let [resultKey, resultRange] of Object.entries(resultRanges)) {
			let { start, end } = resultRange;
			if ((!start || this.total >= start) && (!end || this.total <= end)) {
				resultType = resultKey;
				break;
			}
		}

		this.options.resultType = resultType;
		// Update the templateData.
		resultLabel = resultRanges[resultType]?.label ?? resultType;
		resultDetails = this.data?.moveResults?.[resultType]?.value ?? null;

		// Add the stat label.
		if (stat && this.data.stats[stat]) {
			statMod = this.data.stats[stat].value;
			stat = game.pbta.sheetConfig.actorTypes[this.options.sheetType]?.stats[stat]?.label ?? stat;
		}

		// Prepare chat data
		messageData = foundry.utils.mergeObject({
			user: game.user.id,
			type: CONST.CHAT_MESSAGE_TYPES.ROLL,
			content: String(this.total),
			sound: CONFIG.sounds.dice,

			conditions: this.options.conditions,
			choices: this.data.choices,
			details: this.data.description,
			originalMod: this.options.originalMod,
			result: resultType,
			resultDetails,
			resultLabel,
			resultRanges,
			stat,
			statMod
		}, messageData);
		messageData.rolls = [this];

		// These are abominations from the refactoring but I couldn't figure out how to merge everything into a single ChatMessage.create call
		messageData.rollPbta = await this.render();
		messageData.content = await renderTemplate("systems/pbta/templates/chat/chat-move.html", messageData);

		// Either create the message or just return the chat data
		const cls = getDocumentClass("ChatMessage");
		const msg = new cls(messageData);

		// Either create or return the data
		if (create) {
			return cls.create(msg.toObject(), { rollMode });
		} else if (rollMode) {
			msg.applyRollMode(rollMode);
		}
		return msg.toObject();
	}

	/**
	 * Apply optional modifiers which customize the behavior of the d20term
	 * @private
	 */
	configureModifiers() {
		const r = this.terms[0];

		// Handle Advantage or Disadvantage
		if (this.hasAdvantage) {
			r.modifiers.push(`kh${r.number}`);
			r.number += 1;
			r.options.advantage = true;
			this.options.conditions.push(game.i18n.localize("PBTA.Advantage"));
		} else if (this.hasDisadvantage) {
			r.modifiers.push(`kl${r.number}`);
			r.number += 1;
			r.options.disadvantage = true;
			this.options.conditions.push(game.i18n.localize("PBTA.Disadvantage"));
		}

		const { forward, ongoing } = this.data?.resources ?? {};
		if (forward?.value) {
			const fRoll = new Roll(`${forward.value}`, this.data);
			if (!(fRoll.terms[0] instanceof OperatorTerm)) {
				this.terms.push(new OperatorTerm({ operator: "+" }));
			}
			this.terms = this.terms.concat(fRoll.terms);
			this.options.conditions.push(`${game.i18n.localize("PBTA.Forward")} (${forward.value >= 0 ? "+" : ""} ${forward.value})`);
		}
		if (ongoing?.value) {
			const oRoll = new Roll(`${ongoing.value}`, this.data);
			if (!(oRoll.terms[0] instanceof OperatorTerm)) {
				this.terms.push(new OperatorTerm({ operator: "+" }));
			}
			this.terms = this.terms.concat(oRoll.terms);
			this.options.conditions.push(`${game.i18n.localize("PBTA.Ongoing")} (${ongoing.value >= 0 ? "+" : ""} ${ongoing.value})`);
		}

		// Re-compile the underlying formula
		this._formula = this.constructor.getFormula(this.terms);

		let { minMod, maxMod } = game.pbta.sheetConfig;
		if (minMod || maxMod) {
			minMod ??= -Infinity;
			maxMod ??= Infinity;
			let [baseFormula, modifierString = "0"] = this.formula.split(/([+-].*)/s);
			// This should be a string of integers joined with + and -. This should be safe to eval.
			let originalMod = Roll.safeEval(modifierString);
			if (originalMod < minMod || originalMod > maxMod) {
				let totalMod = Math.clamped(originalMod, minMod, maxMod);
				const newFormula = `${baseFormula}+${totalMod}`.replace(/\+\s*-/g, "-");
				const newTerms = new Roll(newFormula).terms;
				this.terms = newTerms;
				this.options.originalMod = originalMod;
				this._formula = this.constructor.getFormula(this.terms);
			}
		}

		// Mark configuration as complete
		this.options.configured = true;
	}

	/**
	 * Create a Dialog prompt used to configure evaluation of an existing Roll instance.
	 * @param {object} data                     Dialog configuration data
	 * @param {string} [data.template]            A custom path to an HTML template to use instead of the default
	 * @param {string} [data.title]               The title of the shown dialog window
	 * @param {object} options                  Additional Dialog customization options
	 * @returns {Promise<Roll|null>}         A resulting Roll object constructed with the dialog, or null if the
	 *                                          dialog was closed
	 */
	async configureDialog({ template, templateData = {}, title } = {}, options = {}) {
		this.options.conditions = [];
		const needsDialog =
			this.data.rollType === "ask"
			|| this.data.rollType === "prompt"
			|| this.data.conditionGroups.length > 0
			|| (templateData.isStatToken && templateData.numOfToken);

		if (needsDialog) {
			templateData = foundry.utils.mergeObject(templateData, {
				conditionGroups: this.data.conditionGroups,
				hasPrompt: this.data.rollType === "prompt"
			});

			const content = await renderTemplate(template ?? this.constructor.EVALUATION_TEMPLATE, templateData);
			return new Promise((resolve) => {
				title ??= game.i18n.localize("PBTA.RollMove");
				let buttons = {
					submit: {
						label: game.i18n.localize("PBTA.Roll"),
						callback: (html) => {
							resolve(this._onDialogSubmit(html));
						}
					}
				};
				if (this.data.rollType === "ask") {
					title = game.i18n.format("PBTA.AskTitle", { name: templateData.title });
					buttons = Object.entries(this.data.stats)
						.filter((stat) => {
							return !["ask", "prompt", "formula"].includes(stat[0])
								&& !(game.pbta.sheetConfig.statToken && stat[0] === "token");
						})
						.map((stat) => {
							return {
								label: stat[1].label,
								callback: (html) => {
									resolve(this._onDialogSubmit(html, stat[0]));
								}
							};
						});
				} else if (this.data.rollType === "prompt") {
					title = game.i18n.format("PBTA.PromptTitle", { name: templateData.title });
				}

				new Dialog(
					{
						title,
						content,
						default: "submit",
						buttons
					},
					options
				).render(true);
			});
		}
		this.configureModifiers();
		return true;
	}

	/**
	 * Handle submission of the Roll evaluation configuration Dialog
	 * @param {jQuery} html            The submitted dialog content
	 * @param {number} stat   The chosen advantage mode
	 * @returns {Roll}              This damage roll.
	 * @private
	 */
	_onDialogSubmit(html, stat) {
		const form = html[0].querySelector("form");

		const addToFormula = (val) => {
			const statBonus = new Roll(val, this.data);
			if (!(statBonus.terms[0] instanceof OperatorTerm)) {
				this.terms.push(new OperatorTerm({ operator: "+" }));
			}
			this.terms = this.terms.concat(statBonus.terms);
		};

		// Append a situational bonus term
		if (stat) {
			this.options.stat = stat;
			addToFormula(`@stats.${stat}.value`);
		}

		// Customize the modifier
		if (form?.prompt?.value) {
			addToFormula(`${form.prompt.value}`);
		}

		if (form?.condition) {
			let conditions = [];
			if (form.condition.length) {
				conditions = Array.from(form.condition).filter((c) => c.checked);
			} else if (form.condition.checked) {
				conditions.push(form.condition);
			}
			for (let condition of conditions) {
				let { mod, content } = condition.dataset;
				addToFormula(`${mod}`);
				this.options.conditions.push(content);
			}
		}

		// Apply advantage or disadvantage
		this.configureModifiers();
		return this;
	}
}
