const fs = require('fs');
const path = require('path');

const { siteDir } = require('./paths.js');
const SITE_DIR = siteDir();
const DATA = path.join(SITE_DIR, 'data');

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8').replace(/^﻿/, ''));
}
function writeJson(name, data) {
  fs.writeFileSync(path.join(DATA, name), JSON.stringify(data, null, 1), 'utf8');
}

const newFile = process.argv[2];
if (!newFile) {
  console.error('Usage: node merge-variables.js <new-records.json>');
  process.exit(1);
}
const newRecords = JSON.parse(fs.readFileSync(newFile, 'utf8'));

const variables = readJson('variables.json');
const existingIds = new Set(variables.map(v => v.variable_row_id));
const existingKeys = new Set(variables.map(v => v.dataset_id + '|' + v.variable_name));

let added = 0, skipped = 0;
for (const rec of newRecords) {
  if (existingIds.has(rec.variable_row_id) || existingKeys.has(rec.dataset_id + '|' + rec.variable_name)) {
    skipped++;
  } else {
    variables.push(rec);
    added++;
  }
}
writeJson('variables.json', variables);

console.log(`Added ${added}, skipped ${skipped} duplicates. Total variables: ${variables.length}`);
console.log('Run validate_and_update.py to rebuild facets.json and summary.json.');
