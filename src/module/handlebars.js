export class PbtaRegisterHelpers {
	static init() {
		Handlebars.registerHelper("pbtaTags", function (tagsInput) {
			const tags = JSON.parse(tagsInput);
			const tagList = tags.map((tag) => `<div class="tag">${tag.value}</div>`).join("");
			const output = `<div class="tags">${tagList}</div>`;
			return output;
		});

		/**
		 * Similar to Foundry's eq, except "1" == 1 is truthy.
		 */
		Handlebars.registerHelper("softEq", function (arg1, arg2, options) {
			// eslint-disable-next-line eqeqeq
			return (arg1 == arg2);
		});

		/**
		 * Returns length of Object's keys.
		 */
		Handlebars.registerHelper("objLen", function (json) {
			return Object.keys(json).length;
		});

		Handlebars.registerHelper("getLabel", function (obj, key) {
			const result = obj[key]?.label || obj[key] || key;
			return result.length > 0 ? result : key;
		});
	}
}
