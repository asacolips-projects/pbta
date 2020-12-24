/*eslint strict: ["error", "global"]*/
'use strict';

//=======================================================
// Include gulp
//=======================================================
var gulp = require('gulp');

//=======================================================
// Include Our Plugins
//=======================================================
var sass = require('gulp-sass');
var prefix = require('gulp-autoprefixer');
var sourcemaps = require('gulp-sourcemaps');
var sync = require('browser-sync');
var rename = require('gulp-rename');

// Small error handler helper function.
function handleError(err) {
  console.log(err.toString());
  this.emit('end');
}

// Export our tasks.
module.exports = {

  // Compile Sass.
  sass: function() {
    return gulp.src('./styles/src/{global,layout,components}/**/*.scss')
      .pipe(
        sass({ outputStyle: 'nested' })
          .on('error', handleError)
      )
      .pipe(prefix({
        cascade: false
      }))
      .pipe(rename(function(path) {
        path.dirname = '';
        return path;
      }))
      .pipe(gulp.dest('./styles/dist'))
      .pipe(sync.stream({ match: '**/*.css' }));
  }
};
