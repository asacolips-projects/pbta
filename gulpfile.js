const gulp = require('gulp');
const prefix = require('gulp-autoprefixer');
const sourcemaps = require('gulp-sourcemaps');
const sass = require('gulp-sass');
const yaml = require('gulp-yaml');

/* ----------------------------------------- */
/*  Compile Sass
/* ----------------------------------------- */

// Small error handler helper function.
function handleError(err) {
  console.log(err.toString());
  this.emit('end');
}

const SYSTEM_SCSS = ["styles/src/**/*.scss"];
function compileScss() {
  // Configure options for sass output. For example, 'expanded' or 'nested'
  let options = {
    outputStyle: 'nested'
  };
  return gulp.src(SYSTEM_SCSS)
    .pipe(
      sass(options)
        .on('error', handleError)
    )
    .pipe(prefix({
      cascade: false
    }))
    .pipe(gulp.dest("./styles/dist"))
}
const cssTask = gulp.series(compileScss);

/* ----------------------------------------- */
/*  Compile YAML
/* ----------------------------------------- */
const SYSTEM_YAML = ['./yaml/**/*.yml', './yaml/**/*.yaml'];
function compileYaml() {
  return gulp.src(SYSTEM_YAML)
    .pipe(yaml({ space: 2 }))
    .pipe(gulp.dest('./'))
}
const yamlTask = gulp.series(compileYaml);

/* ----------------------------------------- */
/*  Watch Updates
/* ----------------------------------------- */

function watchUpdates() {
  gulp.watch(SYSTEM_SCSS, cssTask);
  gulp.watch(SYSTEM_YAML, yamlTask);
  // gulp.watch(SYSTEM_SCRIPTS, scripts);
}

/* ----------------------------------------- */
/*  Export Tasks
/* ----------------------------------------- */

exports.default = gulp.series(
  compileScss,
  // compileScripts,
  watchUpdates
);
exports.css = cssTask;
exports.yaml = yamlTask;
// exports.scripts = scripts;
