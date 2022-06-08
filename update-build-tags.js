const yargs = require('yargs');
const fs = require('fs');

const argv = yargs
    .option('branch', {
        'type': 'string',
        description: 'specifies the branch (CI_COMMIT_BRANCH)'
    })
    .option('gitlabpath', {
        type: 'string',
        description: 'The path on gitlab where this branch is stored (CI_PROJECT_PATH)'
    })
    .option('jobname', {
      'type': 'string',
      description: 'specifies the job name (CI_JOB_NAME)'
    })
    .option('tag', {
      type: 'string',
      description: 'The git tag used for this version (CI_COMMIT_TAG)'
    })
    .option('bucket', {
      type: 'string',
      description: 'The s3 bucket used for this build (S3_BUCKET)'
    })
    .option('versionpost', {
      type: 'string',
      description: 'specifies the timestamp as a prefix on beta builds (CI_PIPELINE_IID)'
    })
    .demandOption(['branch', 'gitlabpath', 'jobname'])
    .argv;

const systemRaw = fs.readFileSync('./dist/system.json');
let system = JSON.parse(systemRaw);

// Set the artifact path.
let artifactBranch = argv.branch ? argv.branch : 'master';
let artifactVersion = argv.tag ? argv.tag : argv.branch;
let versionParsed = 'master';
let bucket = argv.bucket ? argv.bucket : '';

// Calculate the version.
if (argv.branch && argv.branch == 'beta' && argv.versionpost) {
  let newVersionSplit = system.version.split('.');
  // Set the beta version.
  // newVersionSplit[1]++;
  // newVersionSplit[2] = 0;
  let newVersion = newVersionSplit.join('.');
  system.version = `${newVersion}-beta${argv.versionpost ? argv.versionpost : ''}`;
}
else if (argv.tag) {
  system.version = argv.tag;
  // Determine if this is a pre-release version tag.
  versionParsed = system.version.match(/beta|alpha/);
  if (versionParsed && versionParsed[0]) artifactBranch = versionParsed[0];
}

// Update URLs.
system.url = `https://gitlab.com/${argv.gitlabpath}`;
if (versionParsed == 'beta' || versionParsed == 'alpha') {
  system.manifest = `https://${bucket}.s3.amazonaws.com/${system.name}/${artifactBranch}/system.json`;
  system.download = `https://${bucket}.s3.amazonaws.com/${system.name}/${artifactVersion}/${system.name}.zip`;
}
else {
  if (artifactBranch != 'master') {
    system.manifest = `https://gitlab.com/${argv.gitlabpath}/-/jobs/artifacts/${artifactVersion}/raw/system.json?job=${argv.jobname}`;
  }
  else {
    system.manifest = `https://gitlab.com/${argv.gitlabpath}/-/raw/${artifactBranch}/system.json`;
  }
  system.download = `https://gitlab.com/${argv.gitlabpath}/-/jobs/artifacts/${artifactVersion}/raw/${system.name}.zip?job=${argv.jobname}`;
}

fs.writeFileSync('./dist/system.json', JSON.stringify(system, null, 2));
console.log(`Build: ${system.version}`);
console.log(`Manifest: ${system.manifest}`);
console.log(`Download: ${system.download}`);
