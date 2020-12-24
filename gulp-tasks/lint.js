/*eslint strict: ["error", "global"]*/
'use strict';

//=======================================================
// Include gulp
//=======================================================
var gulp = require('gulp');

//=======================================================
// Include Our Plugins
//=======================================================
var sassLint = require('gulp-sass-lint');
var eslint   = require('gulp-eslint');

// Export our tasks.
module.exports = {

  // Lint Sass based on .sass-lint.yml config.
  sass: function() {
    return gulp.src([
      './scss/{global,layout,components}/**/*.scss',
      '!./scss/global/utils/*'
    ])
      .pipe(sassLint())
      .pipe(sassLint.format());
  },

  // Lint JavaScript based on .eslintrc config.
  js: function() {
    return gulp.src([
      './scss/{global,layout,components}/**/*.js',
      '!./scss/components/**/vendors/*'
    ])
      .pipe(eslint())
      .pipe(eslint.format());
  }
};
