export default class RollPbtA extends Roll {
	static CHAT_TEMPLATE = "systems/pbta/templates/chat/chat-move.html";

	static EVALUATION_TEMPLATE = "systems/pbta/templates/chat/roll-dialog.html";

	/**
	 * A convenience reference for whether this RollPbtA has advantage
	 * @type {boolean}
	 */
	get hasAdvantage() {
		return this.checkAdvDis("adv");
	}

	/* -------------------------------------------- */

	/**
	 * A convenience reference for whether this RollPbtA has disadvantage
	 * @type {boolean}
	 */
	get hasDisadvantage() {
		return this.checkAdvDis("dis");
	}

	checkAdvDis(type) {
		let stat = "";
		if (typeof this.options.stat === "object") {
			stat = this.options.stat.key;
		} else {
			stat = this.options.stat ?? this.options.rollType;
		}
		if (this.data.stats[stat]?.toggle) {
			const { modifier } = game.pbta.sheetConfig.statToggle;
			if (modifier === type) return true;
		}

		return this.options.rollMode === type;
	}

	/** @override */
	async render({ flavor, template=this.constructor.CHAT_TEMPLATE, isPrivate=false }={}) {
		if (!this._evaluated) await this.evaluate();

		const resultRanges = game.pbta.sheetConfig.rollResults;
		let resultType = null;

		// Iterate through each result range until we find a match.
		for (let [resultKey, resultRange] of Object.entries(resultRanges)) {
			let { start, end } = resultRange;
			if ((!start || this.total >= start) && (!end || this.total <= end)) {
				resultType = resultKey;
				break;
			}
		}

		this.options.resultType = resultType;

		const chatData = {
			formula: isPrivate ? "???" : this._formula,
			flavor: isPrivate ? null : flavor ?? this.options.flavor,
			user: game.user.id,
			tooltip: isPrivate ? "" : await this.getTooltip(),
			total: isPrivate ? "?" : Math.round(this.total * 100) / 100,

			conditionsConsumed: this.options.conditionsConsumed,
			conditions: this.options.conditions,
			choices: this.options.choices,
			details: this.options.details,
			originalMod: this.options.originalMod,
			result: resultType,
			resultDetails: this.options?.moveResults?.[resultType]?.value,
			resultLabel: resultRanges[resultType]?.label ?? resultType,
			resultRanges,
			stat: this.options.stat,
			title: this.options.title
		};
		return renderTemplate(template, chatData);
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
		this.options.title = title;
		this.options.conditions = [];
		this.options.conditionsConsumed = [];
		const hasSituationalMods = this.data.resources.forward.value !== 0 || this.data.resources.ongoing.value !== 0;

		const needsDialog =
			this.data.rollType === "ask"
			|| this.data.rollType === "prompt"
			|| hasSituationalMods
			|| this.data.conditionGroups.length > 0
			|| (templateData.isStatToken && templateData.numOfToken);

		if (needsDialog) {
			templateData = foundry.utils.mergeObject(templateData, {
				conditionGroups: this.data.conditionGroups,
				hasPrompt: this.data.rollType === "prompt",
				hasSituationalMods: hasSituationalMods,
				resources: this.data.resources
			});

			const content = await renderTemplate(template ?? this.constructor.EVALUATION_TEMPLATE, templateData);
			return new Promise((resolve) => {
				title = title ? game.i18n.format("PBTA.RollLabel", { label: title }) : game.i18n.localize("PBTA.RollMove");
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
			if (!(statBonus.terms[0] instanceof foundry.dice.terms.OperatorTerm)) {
				this.terms.push(new foundry.dice.terms.OperatorTerm({ operator: "+" }));
			}
			this.terms = this.terms.concat(statBonus.terms);
		};

		// Append a situational bonus term
		if (stat) {
			const { label, value } = this.data.stats[stat];
			this.options.stat = { key: stat, label, value };
			addToFormula(`@stats.${stat}.value`);
		}

		// Customize the modifier
		if (form?.prompt?.value) {
			addToFormula(`${form.prompt.value}`);
		}

		if (form?.forward && form?.forward.checked) {
			const fRoll = new Roll(`${form.forward.dataset.mod}`, this.data);
			if (!(fRoll.terms[0] instanceof foundry.dice.terms.OperatorTerm)) {
				this.terms.push(new foundry.dice.terms.OperatorTerm({ operator: "+" }));
			}
			this.terms = this.terms.concat(fRoll.terms);
			this.options.conditions.push(`${game.i18n.localize("PBTA.Forward")} (${form.forward.dataset.mod >= 0 ? "+" : ""} ${form.forward.dataset.mod})`);
			this.options.conditionsConsumed.push("forward");
		}

		if (form?.ongoing && form?.ongoing.checked) {
			const oRoll = new Roll(`${form.ongoing.dataset.mod}`, this.data);
			if (!(oRoll.terms[0] instanceof foundry.dice.terms.OperatorTerm)) {
				this.terms.push(new foundry.dice.terms.OperatorTerm({ operator: "+" }));
			}
			this.terms = this.terms.concat(oRoll.terms);
			this.options.conditions.push(`${game.i18n.localize("PBTA.Ongoing")} (${form.ongoing.dataset.mod >= 0 ? "+" : ""} ${form.ongoing.dataset.mod})`);
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
