import yargs from 'yargs/yargs';
import * as fs from 'fs';

const argv = yargs(process.argv.slice(2))
  .option('fvtt_token', {
    'type': 'string',
    description: 'Foundry VTT package manager token'
  })
  .demandOption(['fvtt_token'])
  .argv;

// Load the existing manifest.
const systemRaw = fs.readFileSync('./system.json');
let system = JSON.parse(systemRaw);

// Attempt the request.
const release_data = {
  "version": `${system.version}`,
  "manifest": `https://asacolips-artifacts.s3.amazonaws.com/pbta/${system.version}/system.json`,
  "notes": `https://github.com/asacolips-projects/pbta/releases/tag/${system.version}`,
  "compatibility": {
    "minimum": `${system.compatibility.minimum}`,
    "verified": `${system.compatibility.verified}`,
  }
};

/**
 * Reimplements Foundry's isNumeric() function.
 * 
 * Test whether a value is numeric.
 * This is the highest performing algorithm currently available, per https://jsperf.com/isnan-vs-typeof/5
 * @memberof Number
 * @param {*} n       A value to test
 * @return {boolean}  Is it a number?
 */
function isNumeric(n) {
  if ( n instanceof Array ) return false;
  else if ( [null, ""].includes(n) ) return false;
  return +n === +n;
}

/**
 * Reimplements Foundry's isNewerVersion() helper.
 *
 * Return whether a target version (v1) is more advanced than some other reference version (v0).
 * Supports either numeric or string version comparison with version parts separated by periods.
 * @param {number|string} v1    The target version
 * @param {number|string} v0    The reference version
 * @return {boolean}            Is v1 a more advanced version than v0?
 */
function isNewerVersion(v1, v0) {
  if ( (typeof v1 === "number") && (typeof v0 === "number") ) return v1 > v0;
  let v1Parts = String(v1).split(".");
  let v0Parts = String(v0).split(".");
  for ( let [i, p1] of v1Parts.entries() ) {
    let p0 = v0Parts[i];
    if ( p0 === undefined ) return true;
    if ( isNumeric(p0) && isNumeric(p1) ) {
      if ( Number(p1) !== Number(p0) ) return Number(p1) > Number(p0);
    }
    if ( p1 !== p0 ) return p1 > p0;
  }
  if ( v0Parts.length > v1Parts.length ) return false;
  return v1Parts.join(".") !== v0Parts.join(".");
}

// Verify compatibility is valid before adding.
if (system?.compatibility?.maximum && isNewerVersion(system.compatibility.maximum, system.compatibility.verified)) {
  release_data.compatibility.maximum = system.compatibility.maximum;
}

const response = await fetch("https://api.foundryvtt.com/_api/packages/release_version/", {
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `${argv.fvtt_token}`
  },
  method: "POST",
  body: JSON.stringify({
    "id": "pbta",
    // "dry-run": true,
    "release": release_data
  })
});

// Handle response.
const response_data = await response.json()
if (response_data?.status == 'success') {
  console.log(`New release created at ${response_data.page ?? '[page missing from response]'}`);
}
else {
  const error_message = response_data?.errors ? JSON.stringify(response_data.errors) : '[unknown error]';
  console.error(`Error: ${error_message}`);
}