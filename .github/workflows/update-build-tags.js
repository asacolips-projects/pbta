const yargs = require('yargs');
const fs = require('fs');

const argv = yargs
    .option('ref_type', {
        'type': 'string',
        description: 'The ref type (branch or tag)'
    })
    .option('tag', {
      type: 'string',
      description: 'The tag or branch for this ref.'
    })
    .option('bucket', {
      type: 'string',
      description: 'The s3 bucket used for this build (S3_BUCKET)'
    })
    .option('project', {
      type: 'string',
      description: 'The github project, such as asacolips-projects/pbta'
    })
    .demandOption(['ref_type', 'tag', 'bucket', 'project'])
    .argv;

// Load the existing manifest.
const systemRaw = fs.readFileSync('./dist/system.json');
let system = JSON.parse(systemRaw);

// Set the artifact path.
let artifactBranch = argv.ref_type == 'branch' ? argv.tag : 'latest';
let artifactVersion = argv.ref_type == 'tag' ? argv.tag : null;
let versionParsed = 'latest';
let bucket = argv.bucket ? argv.bucket : '';

// Calculate branch based on tag.
if (argv.ref_type == 'tag') {
  artifactVersion = argv.tag;
  system.version = argv.tag;
  // Determine if this is a pre-release version tag.
  versionParsed = system.version.match(/beta|alpha/);
  if (versionParsed && versionParsed[0]) {
    artifactBranch = versionParsed[0];
  }
  // Otherwise, assume it's the latest branch.
  else {
    artifactBranch = 'latest';
  }
}
// Calculate tag based on branch.
else {
  // Load our previous manifest to get the version.
  artifactVersion = system.version;
  artifactBranch = argv.tag;
}

// Update URLs.
system.url = `https://github.com/${argv.project}`;
system.manifest = `https://${bucket}.s3.amazonaws.com/${system.id}/${artifactBranch}/system.json`;
system.download = `https://${bucket}.s3.amazonaws.com/${system.id}/${artifactVersion}/${system.id}.zip`;

fs.writeFileSync('./dist/system.json', JSON.stringify(system, null, 2));
console.log(`Build: ${system.version}`);
console.log(`Project: ${system.url}`);
console.log(`Manifest: ${system.manifest}`);
console.log(`Download: ${system.download}`);
