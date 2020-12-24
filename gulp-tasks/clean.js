/*eslint strict: ["error", "global"]*/
'use strict';

//=======================================================
// Include Our Plugins
//=======================================================
var del = require('del');

// Export our tasks.
module.exports = {

  // Clean CSS files.
  css: function() {
    return del([
      './css/*'
    ], { force: true });
  },

  // // Clean JS files.
  // js: function() {
  //   return del([
  //     './dist/js/*'
  //   ], {force: true});
  // }
};
