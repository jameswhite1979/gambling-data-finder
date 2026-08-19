// Resolves machine-specific paths so they are not hard-coded into this public repo.
//
// Order of resolution:
//   1. the GDF_ONEDRIVE_ROOT environment variable, if set
//   2. local-paths.json in this directory (gitignored)
//
// To set up on a new machine: copy local-paths.example.json to local-paths.json
// and fill in the real path.

const fs = require('fs');
const path = require('path');

const CONFIG = path.join(__dirname, 'local-paths.json');

function fail(msg) {
  console.error(msg);
  console.error('');
  console.error('Fix: copy .claude/commands/scripts/local-paths.example.json to');
  console.error('     .claude/commands/scripts/local-paths.json and set "oneDriveRoot",');
  console.error('     or set the GDF_ONEDRIVE_ROOT environment variable.');
  process.exit(1);
}

function oneDriveRoot() {
  if (process.env.GDF_ONEDRIVE_ROOT) return process.env.GDF_ONEDRIVE_ROOT;
  if (!fs.existsSync(CONFIG)) fail('Missing local path config: ' + CONFIG);
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  } catch (e) {
    fail('Could not parse ' + CONFIG + ': ' + e.message);
  }
  if (!cfg.oneDriveRoot) fail('local-paths.json has no "oneDriveRoot" key');
  return cfg.oneDriveRoot;
}

// The git repo root, derived from this file's own location - no configuration needed.
function repoRoot() {
  return path.resolve(__dirname, '..', '..', '..');
}

function siteDir() {
  return path.join(oneDriveRoot(), 'website');
}

module.exports = { oneDriveRoot, repoRoot, siteDir };
