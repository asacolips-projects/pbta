import fs from "fs-extra";
import gulp from "gulp";
import prefix from "gulp-autoprefixer";
import sass from "gulp-dart-sass";
import sourcemaps from "gulp-sourcemaps";
import webp from "gulp-webp";
import yaml from "gulp-yaml";
import path from "node:path";
import buffer from "vinyl-buffer";
import source from "vinyl-source-stream";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import rollupStream from "@rollup/stream";

import rollupConfig from "./rollup.config.mjs";

/** ******************/
/*  CONFIGURATION   */
/** ******************/

const packageId = "pbta";
const sourceDirectory = "./src";
const distDirectory = "./dist";
const stylesDirectory = `${sourceDirectory}/styles`;
const stylesExtension = "scss";
const sourceFileExtension = "js";
const staticFiles = [
	"assets/icons",
	"styles/lib",
	"templates",
	"scripts"
];
const systemYaml = ["src/yaml/**/*.{yml, yaml}"];
const systemImages = ["src/assets/**/*.{png,jpeg,jpg}"];

/** ******************/
/*      BUILD       */
/** ******************/

let cache;

/**
 * Build the distributable JavaScript code
 */
function buildCode() {
	return rollupStream({ ...rollupConfig(), cache })
		.on("bundle", (bundle) => {
			cache = bundle;
		})
		.pipe(source(`${packageId}.js`))
		.pipe(buffer())
		.pipe(sourcemaps.init({ loadMaps: true }))
		.pipe(sourcemaps.write("."))
		.pipe(gulp.dest(`${distDirectory}/module`));
}

/**
 * Build style sheets
 */
function buildStyles() {
	return gulp.src([`${stylesDirectory}/**/*.${stylesExtension}`], { base: `${stylesDirectory}/src` })
		.pipe(sourcemaps.init({ loadMaps: true }))
		.pipe(sass({ outputStyle: "compressed" }).on("error", sass.logError))
		.pipe(prefix({
			cascade: false
		}))
		.pipe(sourcemaps.write("."))
		.pipe(gulp.dest(`${distDirectory}/styles/dist`));
}

/**
 *
 */
function buildYaml() {
	return gulp.src(systemYaml)
		.pipe(yaml({ space: 2 }))
		.pipe(gulp.dest("./dist"));
}

/**
 *
 */
function buildManifest() {
	return gulp.src("src/yaml/system.yml")
		.pipe(yaml({ space: 2 }))
		.pipe(gulp.dest("./"));
}

/**
 *
 */
function buildImages() {
	return gulp.src(systemImages, {base: "src"})
		.pipe(webp())
		.pipe(gulp.dest("./dist"));
}

/**
 * Copy static files
 */
async function copyFiles() {
	for (const file of staticFiles) {
		if (fs.existsSync(`${sourceDirectory}/${file}`)) {
			await fs.copy(`${sourceDirectory}/${file}`, `${distDirectory}/${file}`);
		}
	}
}

/**
 * Watch for changes for each build step
 */
export function watch() {
	gulp.watch(`${sourceDirectory}/assets/*.{png,jpeg,jpg,svg,webp}`, { ignoreInitial: false }, buildImages);
	gulp.watch(`${sourceDirectory}/**/*.{yml, yaml}`, { ignoreInitial: false }, buildYaml);
	gulp.watch(`${sourceDirectory}/yaml/system.yml`, { ignoreInitial: false }, buildManifest);
	gulp.watch(`${sourceDirectory}/**/*.${sourceFileExtension}`, { ignoreInitial: false }, buildCode);
	gulp.watch(`${stylesDirectory}/**/*.${stylesExtension}`, { ignoreInitial: false }, buildStyles);
	gulp.watch(
		staticFiles.map((file) => `${sourceDirectory}/${file}`),
		{ ignoreInitial: false },
		copyFiles,
	);
}

export const build = gulp.series(clean, gulp.parallel(buildYaml, buildManifest, buildImages, buildCode, buildStyles, copyFiles));

/** ******************/
/*      CLEAN       */
/** ******************/

/**
 * Remove built files from `dist` folder while ignoring source files
 */
export async function clean() {
	const files = [...staticFiles, "assets", "lang", "module", "system.json", "template.json"];

	if (fs.existsSync(`${stylesDirectory}/src/${packageId}.${stylesExtension}`)) {
		files.push("styles");
	}

	console.log(" ", "Files to clean:");
	console.log("   ", files.join("\n    "));

	for (const filePath of files) {
		await fs.remove(`${distDirectory}/${filePath}`);
	}
}
