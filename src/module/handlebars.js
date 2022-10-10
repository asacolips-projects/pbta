export class PbtaRegisterHelpers {
  static init() {
    Handlebars.registerHelper('concat', function() {
      var outStr = '';
      for (var arg in arguments) {
        if (typeof arguments[arg] != 'object') {
          outStr += arguments[arg];
        }
      }
      return outStr;
    });

    Handlebars.registerHelper('toLowerCase', function(str) {
      return str.toLowerCase();
    });

    Handlebars.registerHelper('pbtaTags', function(tagsInput) {
      const tags = JSON.parse(tagsInput);
      let output = '<div class="tags">';
      for (let tag of tags) {
        output += `<div class="tag">${tag.value}</div>`;
      }
      output += '</div>';
      return output;
    });

    Handlebars.registerHelper('includes', function(haystack, needle, options) {
      if (haystack.includes(needle)) {
        return options.fn(this);
      }
    });

    Handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
      return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
    });

    Handlebars.registerHelper('ifor', function(arg1, arg2, options) {
      if (arg1 || arg2) {
        return options.fn(this);
      }
    });

    Handlebars.registerHelper('getLabel', function(obj, key) {
      let result = key;
      if (typeof obj == 'object' && obj[key]) {
        result = (typeof obj[key] == 'object' && obj[key].label) ? obj[key].label : obj[key];
      }
      return result.length > 0 ? result : key;
    });

    Handlebars.registerHelper('progressCircle', function(data) {
      return `<svg class="progress-ring progress-ring--${data.class}" viewBox="0 0 ${data.diameter} ${data.diameter}" width="${data.diameter}" height="${data.diameter}">
      <circle
        class="progress-ring__circle"
        stroke-width="${data.strokeWidth}"
        stroke-dasharray="${data.circumference}"
        stroke-dashoffset="${data.offset}"
        stroke="${data.color}"
        fill="transparent"
        r="${data.radius}"
        cx="${data.position}"
        cy="${data.position}"
      />
    </svg>`;
    });
  }
}