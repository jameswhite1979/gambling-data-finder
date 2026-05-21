const fs = require('fs');
const path = require('path');

const SITE_DIR = path.join('C:', 'Users', 'wppjw', 'OneDrive - Cardiff University',
  'Bids', 'UKRI', 'GHRIPPs', 'Study', 'Data availability', 'website');
const DATA = path.join(SITE_DIR, 'data');

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8').replace(/^﻿/, ''));
}
function writeJson(name, data) {
  fs.writeFileSync(path.join(DATA, name), JSON.stringify(data, null, 1), 'utf8');
}
function uniq(items) {
  return Array.from(new Set(items.filter(Boolean))).sort();
}

const variables = readJson('variables.json');
const datasets = readJson('datasets.json');
const publications = readJson('publications.json');
const questionnaires = readJson('questionnaires.json');
const gamblingMeasures = readJson('gambling_measures.json');
const sources = readJson('sources.json');

const facets = {
  datasets: uniq(variables.map(v => v.dataset_id)),
  construct_categories: uniq(variables.map(v => v.construct_category)),
  roles: uniq(variables.map(v => v.role)),
  risk_domains: uniq(variables.map(v => v.risk_domain)),
  named_measures: uniq(variables.map(v => v.named_measure)),
  wave_years: uniq(variables.map(v => v.wave_year)),
  age_groups: uniq(variables.map(v => v.age_group)),
};
writeJson('facets.json', facets);

const today = new Date().toISOString().slice(0, 10);
const summary = {
  datasets: datasets.length,
  variables: variables.length,
  questionnaires: questionnaires.length,
  gambling_measures: gamblingMeasures.length,
  gambling_variables: variables.filter(v => v.role === 'Gambling measure').length,
  risk_protective_variables: variables.filter(v => v.role === 'Risk/protective factor').length,
  source_urls: sources.length,
  last_updated: today,
  publications: publications.length,
};
writeJson('summary.json', summary);

console.log('Rebuilt facets.json:', Object.entries(facets).map(([k, v]) => `${k}=${v.length}`).join(', '));
console.log('Rebuilt summary.json:', JSON.stringify(summary, null, 2));
